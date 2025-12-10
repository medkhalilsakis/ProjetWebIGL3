import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { interval, Subscription, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { AuthService, User } from '../services/authentification';
import { ToastService } from '../services/toast';
import { NotificationService, Notification } from '../services/notification';

interface DashboardStats {
  ordersToday: number;
  ordersWeek: number;
  ordersMonth: number;
  revenueToday: number;
  revenueWeek: number;
  revenueMonth: number;
  rating: number;
  avgPrepTime: number;
  totalOrders: number;
}

interface SupplierStatsSummary {
  totalOrders?: number;
  totalRevenue?: number;
  totalProducts?: number;
  ordersToday?: number;
  revenueToday?: number;
}

interface Commande {
  id: string;
  statut: 'en_attente' | 'en_preparation' | 'pret_pour_livraison' | 'en_livraison' | 'livree' | 'annulee' | string;
  date_commande?: string;
  montant_total?: number;
  frais_service?: number;
  frais_livraison?: number;
  mode_paiement?: string;
  instructions_speciales?: string;
  client_nom?: string;
  fournisseur_nom?: string;
  livreur_nom?: string;
  rue?: string;
  ville?: string;
  produits?: any[];
}

interface Product {
  id?: string;
  nom: string;
  description?: string;
  prix: number;
  quantite: number;
  categorie_id: string;
  image: string;
  status?: 'active' | 'out_of_stock';
  promotionPercent?: number;
  options?: string[];
  variantes?: string[];
  images_additionnelles?: string[];
  _showImages?: boolean; // UI-only flag for gallery toggle
}

interface Promotion {
  id: string;
  code: string;
  description: string;
  reduction: number;
  type: 'coupon' | 'happy_hour' | 'special';
  active: boolean;
  periode?: { debut: string; fin: string };
  produitId?: string | null;
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  author: string;
  date: string;
}

@Component({
  selector: 'app-fournisseur-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './fournisseur-dashboard.html',
  styleUrls: ['./fournisseur-dashboard.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FournisseurDashboard implements OnInit, OnDestroy {
  private apiUrl = 'http://localhost:3000/api';

  currentUser: User | null = null;

  activeTab:
    | 'commandes'
    | 'produits'
    | 'promotions'
    | 'statistiques'
    | 'profil'
    | 'support'
    | 'avis'
    | 'avances' = 'commandes';

  // Commandes
  commandes: Commande[] = [];
  commandesFiltrees: Commande[] = [];
  commandeSelectionnee: Commande | null = null;
  filtreStatut: 'toutes' | 'en_cours' | 'livrees' | 'annulees' = 'en_cours';
  commandesLoading = false;

  // Produits
  produits: Product[] = [];
  produitsPagines: Product[] = [];
  currentPage = 1;
  itemsPerPage = 10;
  visibleItems = 3;
  categories: { id: string; name: string }[] = [];
  produitForm!: FormGroup;
  varianteInput = '';
  optionInput = '';
  imagePrincipaleFile: File | null = null;
  imagesAdditionnelles: File[] = [];
  produitEdition: Product | null = null;
  produitsLoading = false;

  // Promotions (local state — backend non spécifié)
  promotions: Promotion[] = [];
  promotionForm!: FormGroup;

  // Stats
  stats: DashboardStats = {
    ordersToday: 0,
    ordersWeek: 0,
    ordersMonth: 0,
    revenueToday: 0,
    revenueWeek: 0,
    revenueMonth: 0,
    rating: 0,
    avgPrepTime: 0,
    totalOrders: 0
  };
  statsSummary: SupplierStatsSummary = {};
  statsLoading = false;
  charts = {
    revenue: [] as { label: string; value: number }[],
    orders: [] as { label: string; value: number }[]
  };

  // Profil établissement
  businessInfo = {
    nom: '',
    adresse: '',
    horaires: '',
    informationsBancaires: '',
    disponibilite: 'ouvert'
  };
  profileFile: File | null = null;
  profileUploading = false;

  // Support & communication
  supportMessage = '';
  chatMessages: { from: 'client' | 'fournisseur'; message: string; at: Date }[] = [];
  chatDraft = '';

  // Avis
  avis: Review[] = [];
  avisLoading = false;

  // Notifications
  notifications: Notification[] = [];
  unreadNotifications = 0;

  // Misc
  private refreshSub?: Subscription;

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private auth: AuthService,
    private toast: ToastService,
    private notifService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {
    this.currentUser = this.auth.currentUserValue;
    this.auth.currentUser.subscribe((u) => {
      this.currentUser = u;
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    this.initForms();
    this.loadAll();
    this.observeNotifications();

    // refresh commandes / stats toutes les 45s
    this.refreshSub = interval(45000).subscribe(() => {
      this.loadCommandes(this.filtreStatut);
      this.loadStats();
    });
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
  }

  // ---------- Initialisation ----------
  private initForms(): void {
    this.produitForm = this.fb.group({
      nom: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      prix: [0, [Validators.required, Validators.min(0.1)]],
      quantite: [0, [Validators.required, Validators.min(0)]],
      categorie_id: ['', Validators.required],
      promotionPercent: [0, [Validators.min(0), Validators.max(90)]],
      disponible: [true],
      options: [[]],
      variantes: [[]]
    });

    this.promotionForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      reduction: [10, [Validators.required, Validators.min(1), Validators.max(90)]],
      type: ['coupon'],
      produitId: [null],
      debut: [''],
      fin: ['']
    });
  }

  public loadAll(): void {
    this.loadCommandes(this.filtreStatut);
    this.loadProduits();
    this.loadCategories();
    this.loadStats();
    this.loadStatsSummary();
    this.loadAvis();
  }

  // ---------- Notifications ----------
  private observeNotifications(): void {
    this.notifService.notifications$.subscribe((n) => {
      this.notifications = n || [];
      this.cdr.markForCheck();
    });
    this.notifService.unreadCount$.subscribe((c) => {
      this.unreadNotifications = c ?? 0;
      this.cdr.markForCheck();
    });
    this.notifService.loadNotifications();
  }

  // ---------- Commandes ----------
  switchTab(tab: FournisseurDashboard['activeTab']): void {
    this.activeTab = tab;
    if (tab === 'commandes') this.loadCommandes(this.filtreStatut);
    if (tab === 'produits') this.loadProduits();
    if (tab === 'statistiques') this.loadStats();
    if (tab === 'avis') this.loadAvis();
    this.cdr.markForCheck();
  }

  loadCommandes(filtre: 'toutes' | 'en_cours' | 'livrees' | 'annulees' = 'en_cours'): void {
    this.commandesLoading = true;
    this.filtreStatut = filtre;

    let params = new HttpParams().set('limit', '100');
    if (filtre === 'livrees') params = params.set('statut', 'livree');
    if (filtre === 'annulees') params = params.set('statut', 'annulee');

    this.http
      .get<any>(`${this.apiUrl}/commandes`, { params, ...this.auth.getAuthHeaders() })
      .pipe(
        catchError((err) => {
          console.error('Erreur chargement commandes', err);
          this.toast.showToast('Impossible de récupérer les commandes', 'error');
          this.commandes = [];
          this.commandesFiltrees = [];
          this.commandesLoading = false;
          this.cdr.markForCheck();
          return of({ success: false, commandes: [] });
        })
      )
      .subscribe((res) => {
        if (res?.success && Array.isArray(res.commandes)) {
          this.commandes = res.commandes;
          this.commandesFiltrees = this.filterCommandes(res.commandes, filtre);
        } else {
          this.commandes = [];
          this.commandesFiltrees = [];
        }
        this.commandesLoading = false;
        this.cdr.markForCheck();
      });
  }

  private filterCommandes(list: Commande[], filtre: FournisseurDashboard['filtreStatut']): Commande[] {
    if (filtre === 'toutes') return list;
    if (filtre === 'livrees') return list.filter((c) => c.statut === 'livree');
    if (filtre === 'annulees') return list.filter((c) => c.statut === 'annulee');
    // en cours
    return list.filter((c) => c.statut !== 'livree' && c.statut !== 'annulee');
  }

  ouvrirCommande(cmd: Commande): void {
    this.commandeSelectionnee = cmd;
  }

  mettreAJourStatut(cmd: Commande, nouveauStatut: Commande['statut']): void {
    if (!cmd?.id) return;
    this.http
      .put<any>(`${this.apiUrl}/commandes/${cmd.id}/statut`, { statut: nouveauStatut }, this.auth.getAuthHeaders())
      .subscribe({
        next: (res) => {
          if (res?.success) {
            cmd.statut = nouveauStatut;
            this.toast.showToast('Statut mis à jour', 'success');
            this.loadCommandes(this.filtreStatut);
          }
        },
        error: (err) => {
          console.error('maj statut', err);
          this.toast.showToast('Impossible de mettre à jour le statut', 'error');
        }
      });
  }

  getStatutBadge(statut: Commande['statut']): string {
    const map: Record<string, string> = {
      en_attente: 'badge-warning',
      en_preparation: 'badge-info',
      pret_pour_livraison: 'badge-primary',
      en_livraison: 'badge-primary',
      livree: 'badge-success',
      annulee: 'badge-danger'
    };
    return `badge ${map[statut] || 'badge-secondary'}`;
  }

  // ---------- Produits ----------
  loadCategories(): void {
    this.http
      .get<any>(`${this.apiUrl}/categories`)
      .pipe(
        catchError((err) => {
          console.error('Erreur chargement catégories', err);
          this.categories = [];
          return of({ success: false, data: [] });
        })
      )
      .subscribe((res) => {
        if (res?.success && Array.isArray(res.data)) {
          this.categories = res.data;
        }
        this.cdr.markForCheck();
      });
  }

  loadProduits(): void {
    this.produitsLoading = true;
    this.http
      .get<any>(`${this.apiUrl}/fournisseur/produits`, this.auth.getAuthHeaders())
      .pipe(
        catchError((err) => {
          console.error('Erreur chargement produits', err);
          this.toast.showToast('Impossible de récupérer les produits', 'error');
          this.produits = [];
          this.produitsLoading = false;
          this.cdr.markForCheck();
          return of({ success: false, data: [] });
        })
      )
      .subscribe((res) => {
        this.produits = (res?.data || []).map((p: any) => ({
          ...p,
          image: this.toAbsoluteUrl(p.image),
          images_additionnelles: (p.images_additionnelles || []).map((img: string) => this.toAbsoluteUrl(img)),
          _showImages: false
        }));
        this.updatePaginatedProducts();
        this.produitsLoading = false;
        this.cdr.markForCheck();
      });
  }

  onMainImageSelected(event: any): void {
    const file = event?.target?.files?.[0];
    if (file) this.imagePrincipaleFile = file;
  }

  onAdditionalImagesSelected(event: any): void {
    const files = event?.target?.files;
    if (files?.length) this.imagesAdditionnelles = Array.from(files);
  }

  ajouterVariante(): void {
    const val = this.varianteInput.trim();
    if (!val) return;
    const current = this.produitForm.get('variantes')?.value || [];
    this.produitForm.patchValue({ variantes: [...current, val] });
    this.varianteInput = '';
  }

  ajouterOption(): void {
    const val = this.optionInput.trim();
    if (!val) return;
    const current = this.produitForm.get('options')?.value || [];
    this.produitForm.patchValue({ options: [...current, val] });
    this.optionInput = '';
  }

  private uploadImages() {
    if (!this.imagePrincipaleFile) return of(null);
    const fd = new FormData();
    fd.append('image_principale', this.imagePrincipaleFile);
    this.imagesAdditionnelles.slice(0, 5).forEach((file) => fd.append('images_additionnelles', file));

    const opts = this.auth.getAuthHeaders();
    // Avoid forcing Content-Type when sending FormData
    const headers = (opts?.headers as HttpHeaders | undefined)?.delete('Content-Type');

    return this.http.post<any>(`${this.apiUrl}/fournisseur/upload-images`, fd, { headers }).pipe(
      map((res) => (res?.success ? res.data : null)),
      catchError((err) => {
        console.error('upload images', err);
        this.toast.showToast('Échec de l\'upload des images', 'error');
        return of(null);
      })
    );
  }

  enregistrerProduit(): void {
    if (this.produitForm.invalid) {
      this.toast.showToast('Veuillez compléter le formulaire produit', 'warning');
      return;
    }

    const formValue = this.produitForm.value;
    const create$ = this.uploadImages().pipe(
      switchMap((images) => {
        if (!images?.mainImage) {
          this.toast.showToast('Image principale obligatoire', 'error');
          return of(null);
        }
        const payload: any = {
          nom: formValue.nom,
          description: formValue.description || '',
          prix: formValue.prix,
          quantite: formValue.quantite,
          categorie_id: formValue.categorie_id,
          image: images.mainImage
        };
        return this.http.post<any>(`${this.apiUrl}/fournisseur/produits`, payload, this.auth.getAuthHeaders());
      })
    );

    create$.subscribe({
      next: (res) => {
        if (res?.success) {
          this.toast.showToast('Produit ajouté', 'success');
          this.resetProduitForm();
          this.loadProduits();
        }
      },
      error: (err) => {
        console.error('add product', err);
        this.toast.showToast('Impossible d\'ajouter le produit', 'error');
      }
    });
  }

  modifierProduit(produit: Product): void {
    this.produitEdition = produit;
    this.produitForm.patchValue({
      nom: produit.nom,
      description: produit.description || '',
      prix: produit.prix,
      quantite: produit.quantite,
      categorie_id: produit.categorie_id,
      promotionPercent: produit.promotionPercent || 0,
      disponible: produit.status !== 'out_of_stock'
    });
    this.activeTab = 'produits';
    this.cdr.markForCheck();
  }

  enregistrerEdition(): void {
    if (!this.produitEdition || this.produitForm.invalid) return;
    const val = this.produitForm.value;
    const payload: any = {
      nom: val.nom,
      description: val.description,
      prix: val.prix,
      quantite: val.quantite,
      status: val.disponible ? 'active' : 'out_of_stock',
      categorie_id: val.categorie_id,
      promotionPercent: val.promotionPercent
    };

    this.http
      .put<any>(`${this.apiUrl}/fournisseur/produits/${this.produitEdition.id}`, payload, this.auth.getAuthHeaders())
      .subscribe({
        next: (res) => {
          if (res?.success) {
            this.toast.showToast('Produit mis à jour', 'success');
            this.produitEdition = null;
            this.resetProduitForm();
            this.loadProduits();
          }
        },
        error: (err) => {
          console.error('maj produit', err);
          this.toast.showToast('Impossible de mettre à jour le produit', 'error');
        }
      });
  }

  supprimerProduit(produit: Product): void {
    if (!produit?.id) return;
    if (!confirm(`Supprimer ${produit.nom} ?`)) return;
    this.http.delete<any>(`${this.apiUrl}/fournisseur/produits/${produit.id}`, this.auth.getAuthHeaders()).subscribe({
      next: (res) => {
        if (res?.success) {
          this.toast.showToast('Produit supprimé', 'success');
          this.loadProduits();
        }
      },
      error: (err) => {
        console.error('delete produit', err);
        this.toast.showToast('Suppression impossible', 'error');
      }
    });
  }

  basculerDisponibilite(produit: Product): void {
    const payload = {
      status: produit.status === 'out_of_stock' ? 'active' : 'out_of_stock'
    };
    this.http
      .put<any>(`${this.apiUrl}/fournisseur/produits/${produit.id}`, payload, this.auth.getAuthHeaders())
      .subscribe({
        next: (res) => {
          if (res?.success) {
            produit.status = payload.status as any;
            this.toast.showToast('Disponibilité mise à jour', 'success');
            this.cdr.markForCheck();
          }
        },
        error: () => this.toast.showToast('Impossible de changer la disponibilité', 'error')
      });
  }

  toggleImages(produit: Product): void {
    produit._showImages = !produit._showImages;
    this.cdr.markForCheck();
  }

  resolveImage(src: string | null | undefined): string | null {
    if (!src) return null;
    return this.toAbsoluteUrl(src);
  }

  private toAbsoluteUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    // backend serves uploads at http://localhost:3000/uploads/...
    const trimmed = path.startsWith('/') ? path.slice(1) : path;
    return `http://localhost:3000/${trimmed}`;
  }

  resetProduitForm(): void {
    this.produitForm.reset({
      nom: '',
      description: '',
      prix: 0,
      quantite: 0,
      categorie_id: '',
      promotionPercent: 0,
      disponible: true
    });
    this.imagePrincipaleFile = null;
    this.imagesAdditionnelles = [];
    this.varianteInput = '';
    this.optionInput = '';
  }

  // ---------- Promotions (local only) ----------
  ajouterPromotion(): void {
    if (this.promotionForm.invalid) {
      this.toast.showToast('Complétez la promotion', 'warning');
      return;
    }
    const val = this.promotionForm.value;
    const promo: Promotion = {
      id: this.randomId(),
      code: val.code,
      description: val.description || '',
      reduction: val.reduction,
      type: val.type,
      produitId: val.produitId,
      active: true,
      periode: val.debut && val.fin ? { debut: val.debut, fin: val.fin } : undefined
    };
    this.promotions.unshift(promo);
    this.toast.showToast('Promotion créée (front)', 'info');
    this.promotionForm.reset({ code: '', description: '', reduction: 10, type: 'coupon', produitId: null, debut: '', fin: '' });
  }

  basculerPromotion(promo: Promotion): void {
    promo.active = !promo.active;
  }

  supprimerPromotion(promo: Promotion): void {
    this.promotions = this.promotions.filter((p) => p.id !== promo.id);
  }

  // ---------- Statistiques ----------
  loadStats(): void {
    this.statsLoading = true;
    this.http
      .get<any>(`${this.apiUrl}/fournisseur/stats`, this.auth.getAuthHeaders())
      .pipe(
        catchError((err) => {
          console.error('stats', err);
          this.statsLoading = false;
          this.cdr.markForCheck();
          return of({ success: false });
        })
      )
      .subscribe((res) => {
        if (res?.success && res.data) this.stats = res.data;
        this.refreshCharts();
        this.statsLoading = false;
        this.cdr.markForCheck();
      });
  }

  loadStatsSummary(): void {
    this.http
      .get<any>(`${this.apiUrl}/statistiques/fournisseur`, this.auth.getAuthHeaders())
      .pipe(catchError(() => of({ success: false, data: {} })))
      .subscribe((res) => {
        this.statsSummary = res?.data || {};
        this.refreshCharts();
        this.cdr.markForCheck();
      });
  }

  formatCurrency(v: number | undefined): string {
    return (v || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  }

  // ---------- Profil ----------
  sauvegarderProfil(): void {
    const current = this.auth.currentUserValue;
    if (!current) return;
    const payload = {
      nom_complet: this.businessInfo.nom || current.nom_complet,
      adresse: this.businessInfo.adresse || null,
      horaires: this.businessInfo.horaires || null
    };
    this.auth.updateProfile(payload).subscribe({
      next: (res) => {
        if (res?.success) this.toast.showToast('Profil mis à jour', 'success');
      },
      error: () => this.toast.showToast('Impossible de mettre à jour le profil', 'error')
    });
  }

  // ---------- Support & Chat ----------
  envoyerSupport(): void {
    if (!this.supportMessage.trim()) {
      this.toast.showToast('Message vide', 'warning');
      return;
    }
    // Pas d'endpoint dédié côté backend; on log et notifie
    console.info('Support message', this.supportMessage);
    this.toast.showToast('Message envoyé au support (local)', 'info');
    this.supportMessage = '';
  }

  envoyerChat(): void {
    if (!this.chatDraft.trim()) return;
    this.chatMessages.push({ from: 'fournisseur', message: this.chatDraft, at: new Date() });
    this.chatDraft = '';
  }

  // ---------- Avis ----------
  loadAvis(): void {
    this.avisLoading = true;
    this.http
      .get<any>(`${this.apiUrl}/avis/fournisseur`, this.auth.getAuthHeaders())
      .pipe(
        catchError((err) => {
          console.error('avis', err);
          this.toast.showToast('Impossible de charger les avis', 'error');
          this.avis = [];
          this.avisLoading = false;
          this.cdr.markForCheck();
          return of({ success: false, data: [] });
        })
      )
      .subscribe((res) => {
        this.avis = res?.data || [];
        this.avisLoading = false;
        this.cdr.markForCheck();
      });
  }

  repondreAvis(review: Review): void {
    this.toast.showToast(`Réponse envoyée à ${review.author} (mock)`, 'info');
  }

  // ---------- Profil / Auth ----------
  logout(): void {
    this.auth.logout();
    this.toast.showToast('Déconnecté', 'info');
  }

  onProfileFileSelected(event: any): void {
    const file = event?.target?.files?.[0];
    this.profileFile = file || null;
  }

  uploadProfile(): void {
    if (!this.profileFile) {
      this.toast.showToast('Choisissez une image', 'warning');
      return;
    }
    this.profileUploading = true;
    this.auth.uploadProfileImage(this.profileFile).subscribe({
      next: (resp) => {
        if (resp?.success && resp.photo_url) {
          this.toast.showToast('Photo mise à jour', 'success');
        } else {
          this.toast.showToast(resp?.message || 'Échec mise à jour photo', 'error');
        }
        this.profileUploading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('upload profile', err);
        this.profileUploading = false;
        this.toast.showToast('Erreur upload photo', 'error');
        this.cdr.markForCheck();
      }
    });
  }

  // ---------- Charts helpers ----------
  refreshCharts(): void {
    this.charts.orders = [
      { label: 'Jour', value: this.stats.ordersToday || 0 },
      { label: 'Semaine', value: this.stats.ordersWeek || 0 },
      { label: 'Mois', value: this.stats.ordersMonth || 0 }
    ];
    this.charts.revenue = [
      { label: 'Jour', value: this.stats.revenueToday || 0 },
      { label: 'Semaine', value: this.stats.revenueWeek || 0 },
      { label: 'Mois', value: this.stats.revenueMonth || 0 }
    ];
  }

  chartBarWidth(val: number, max: number): string {
    if (!max || max <= 0) return '0%';
    const pct = Math.max(3, Math.min(100, (val / max) * 100));
    return `${pct}%`;
  }

  // ---------- Pagination Produits ----------
  updatePaginatedProducts(): void {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.produitsPagines = this.produits.slice(start, end);
  }

  get totalPages(): number {
    return Math.ceil(this.produits.length / this.itemsPerPage);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedProducts();
      this.cdr.markForCheck();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePaginatedProducts();
      this.cdr.markForCheck();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedProducts();
      this.cdr.markForCheck();
    }
  }

  private randomId(): string {
    const globalCrypto: any = (typeof crypto !== 'undefined') ? crypto : null;
    if (globalCrypto?.randomUUID) return globalCrypto.randomUUID();
    return Math.random().toString(36).slice(2, 10);
  }
}
