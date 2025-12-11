import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { interval, Subscription, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/authentification';
import { ToastService } from '../services/toast';
import { NotificationService, Notification } from '../services/notification';
import { MatIconModule } from '@angular/material/icon';

interface Order {
  id: string;
  numero_suivi?: string;
  fournisseur?: string;
  montant_total: number;
  statut: 'en_attente' | 'en_preparation' | 'pret_pour_livraison' | 'en_livraison' | 'livree' | 'annulee';
  date_commande?: string;
  date_livraison_reelle?: string;
  adresse_livraison_id?: string;
  instructions_speciales?: string;
  livreur_nom?: string;
  produits?: OrderItem[];
  frais_service?: number;
  frais_livraison?: number;
  mode_paiement?: string;
}

interface OrderItem {
  produit_id: string;
  nom: string;
  quantite: number;
  prix_unitaire: number;
}

interface Address {
  id: string;
  rue: string;
  ville: string;
  gouvernorat?: string;
  code_postal: string;
  complement?: string;
  est_principale: boolean;
  libelle?: string;
}

interface PaymentMethod {
  id: string;
  type: 'carte' | 'portefeuille' | 'especes';
  numero?: string;
  nom?: string;
  expiration?: string;
  est_par_defaut: boolean;
}

interface Supplier {
  id: string;
  nom_entreprise: string;
  type_fournisseur: string;
  photo_couverture?: string;
  note_moyenne?: number;
  nombre_avis?: number;
  temps_preparation_moyen?: number;
  frais_livraison?: number;
  distance?: number;
}

interface LoyaltyLevel {
  level: string;
  points: number;
  nextLevel: string;
  pointsNeeded: number;
  progress: number;
}

interface SupportTicket {
  id: string;
  sujet: string;
  message: string;
  statut: 'ouvert' | 'en_cours' | 'resolu';
  date_creation: string;
}

interface CartItem {
  product: {
    id?: string;
    nom: string;
    prix: number;
    prix_promotion?: number;
  };
  quantity: number;
}

interface DeliveryOption {
  livreur: string;
  etaMinutes: number;
  price: number;
}

interface Livreur {
  id: string;
  utilisateur_id: string;
  nom_complet: string;
  email: string;
  telephone: string;
  photo_profil?: string;
  type_vehicule: string;
  note_moyenne: number;
  nombre_livraisons: number;
  tarif_par_km: number;
  zones_livraison: string[];
}

interface DeliveryEstimate {
  gouvernorat: string;
  distance_km: number;
  temps_estime_minutes: number;
}

@Component({
  selector: 'app-client-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './client-dashboard.html',
  styleUrls: ['./client-dashboard.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientDashboardComponent implements OnInit, OnDestroy {
  private apiUrl = 'http://localhost:3000/api';

  activeTab:
    | 'accueil'
    | 'commande_en_cours'
    | 'historique'
    | 'recommandations'
    | 'preferences'
    | 'portefeuille'
    | 'support'
    | 'parametres'
    | 'fidelite'
    | 'notifications' = 'accueil';

  // User info
  currentUser: any = null;
  profileImageFile: File | null = null;

  // Active order tracking
  activeOrder: Order | null = null;
  driverLocation: { lat: number; lng: number } | null = null;
  etaMinutes: number = 0;

  // Orders history
  orders: Order[] = [];
  ordersLoading = false;
  orderFilter: 'toutes' | 'livrees' | 'annulees' = 'toutes';
  dateFilter: string = '';
  categoryFilter: string = '';

  // Governorates
  readonly GOVERNORATES = [
    'Tunis', 'Ariana', 'Ben Arous', 'La Manouba', 'Nabeul', 'Zaghouan', 'Sousse',
    'Monastir', 'Mahdia', 'Sfax', 'Gafsa', 'Tataouine', 'Médenine', 'Djerba',
    'Gabès', 'Tozeur', 'Kasserine', 'Sidi Bouzid', 'Kairouan', 'Kébili',
    'Manouba', 'Jendouba', 'Le Kef', 'Siliana', 'Béja'
  ];

  // Addresses
  addresses: Address[] = [];
  addressForm!: FormGroup;
  showAddressForm = false;
  selectedGouvernorat: string | null = null;

  // Payment methods
  paymentMethods: PaymentMethod[] = [];
  paymentForm!: FormGroup;
  showPaymentForm = false;

  // Recommendations
  recommendedSuppliers: Supplier[] = [];
  promotions: any[] = [];
  themes: string[] = ['Vegan', 'Tendances', 'Livraison express', 'Bon marché'];

  // Preferences
  preferencesForm!: FormGroup;
  allergens: string[] = ['Gluten', 'Lactose', 'Arachides', 'Fruits de mer', 'Œufs'];
  selectedAllergens: string[] = [];
  dietaryPreferences: string[] = ['Végétarien', 'Végétalien', 'Sans gluten', 'Halal', 'Casher'];
  selectedDietary: string[] = [];

  // Wallet
  walletBalance: number = 0;
  promoCode = '';
  paymentHistory: any[] = [];

  // Support
  supportForm!: FormGroup;
  tickets: SupportTicket[] = [];
  chatMessages: { from: 'client' | 'support'; message: string; at: Date }[] = [];
  chatDraft = '';

  // Loyalty
  loyalty: LoyaltyLevel = {
    level: 'Bronze',
    points: 250,
    nextLevel: 'Argent',
    pointsNeeded: 500,
    progress: 50
  };
  rewards: any[] = [];
  pointsHistory: any[] = [];

  // Notifications
  notifications: Notification[] = [];
  unreadCount = 0;

  // Settings
  settingsForm!: FormGroup;
  twoFactorEnabled = false;

  // Cart (shared local storage)
  cart: CartItem[] = [];
  private cartKey = 'lx_cart';
  selectedAddressId: string | null = null;
  paymentChoice: 'carte' | 'espece' = 'carte';
  deliveryOptions: DeliveryOption[] = [];
  searchingDelivery = false;

  // Checkout fields
  availableLivreurs: Livreur[] = [];
  selectedLivreur: Livreur | null = null;
  deliveryEstimate: DeliveryEstimate | null = null;
  cartCity: string = '';
  
  // Card payment (virtual, temporary)
  cardInfo = {
    numero: '',
    titulaire: '',
    expiration: '',
    cvv: ''
  };
  cardFilled = false;

  // Order summary
  orderSummary = {
    sousTotal: 0,
    fraisLivraison: 0,
    fraisService: 0,
    total: 0
  };

  // Checkout step
  checkoutStep: 'address' | 'payment' | 'livreur' | 'summary' = 'address';

  // Order confirmation state
  orderConfirmationState: 'waiting' | 'confirmed' | null = null;
  lastConfirmedOrderId: string | null = null;
  confirmationMessage: string = '';
  driverLocation = { lat: 48.8566, lng: 2.3522 }; // Default (Paris)
  driverETA: number = 0;

  private refreshSub?: Subscription;

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private auth: AuthService,
    private toast: ToastService,
    private notifService: NotificationService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.currentUser = this.auth.currentUserValue;
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  goProducts(): void {
    this.router.navigate(['/produits']);
  }

  ngOnInit(): void {
    this.loadCart();
    this.selectedAddressId = this.addresses[0]?.id || null;
    this.initForms();
    this.loadAll();
    this.observeNotifications();

    // Refresh active order every 10s
    this.refreshSub = interval(10000).subscribe(() => {
      if (this.activeOrder) this.loadActiveOrder();
    });
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
  }

  private initForms(): void {
    this.addressForm = this.fb.group({
      rue: ['', Validators.required],
      ville: ['', Validators.required],
      code_postal: ['', Validators.required],
      complement: [''],
      libelle: [''],
      est_principale: [false]
    });

    this.paymentForm = this.fb.group({
      type: ['carte', Validators.required],
      numero: [''],
      nom: [''],
      expiration: [''],
      est_par_defaut: [false]
    });

    this.preferencesForm = this.fb.group({
      horaires_preferes: [''],
      notifications_email: [true],
      notifications_sms: [false],
      notifications_push: [true]
    });

    this.supportForm = this.fb.group({
      sujet: ['', Validators.required],
      message: ['', Validators.required]
    });

    this.settingsForm = this.fb.group({
      nom_complet: ['', Validators.required],
      telephone: [''],
      email: ['', [Validators.required, Validators.email]],
      mot_de_passe: [''],
      mot_de_passe_confirme: ['']
    });
  }

  private loadAll(): void {
    this.loadActiveOrder();
    this.loadOrders();
    this.loadAddresses();
    this.loadPaymentMethods();
    this.loadRecommendations();
    this.loadPreferences();
    this.loadWallet();
    this.loadTickets();
    this.loadLoyalty();
    this.loadSettings();
  }

  // ---------- Notifications ----------
  private observeNotifications(): void {
    this.notifService.notifications$.subscribe((n) => {
      this.notifications = n || [];
      this.cdr.markForCheck();
    });
    this.notifService.unreadCount$.subscribe((c) => {
      this.unreadCount = c ?? 0;
      this.cdr.markForCheck();
    });
    this.notifService.loadNotifications();
  }

  // ---------- Navigation ----------
  switchTab(tab: ClientDashboardComponent['activeTab']): void {
    this.activeTab = tab;
    if (tab === 'historique') this.loadOrders();
    if (tab === 'recommandations') this.loadRecommendations();
    if (tab === 'support') this.loadTickets();
    this.cdr.markForCheck();
  }

  // ---------- Profile & Image ----------
  onProfileImageSelected(event: any): void {
    const file = event?.target?.files?.[0];
    if (file) {
      this.profileImageFile = file;
      this.uploadProfileImage();
    }
  }

  uploadProfileImage(): void {
    if (!this.profileImageFile) return;
    this.auth.uploadProfileImage(this.profileImageFile).subscribe({
      next: (res) => {
        if (res?.success) {
          this.toast.showToast('Photo de profil mise à jour', 'success');
          this.currentUser = this.auth.currentUserValue;
          this.cdr.markForCheck();
        }
      },
      error: () => this.toast.showToast('Erreur upload photo', 'error')
    });
  }

  resolveImage(url: string | null | undefined): string {
    if (!url) return 'assets/default-avatar.png';
    if (url.startsWith('http')) return url;
    return `http://localhost:3000${url.startsWith('/') ? '' : '/'}${url}`;
  }

  // ---------- Active Order ----------
  loadActiveOrder(): void {
    this.http
      .get<any>(`${this.apiUrl}/commandes?statut=en_preparation&limit=1`, this.auth.getAuthHeaders())
      .pipe(
        catchError(() => of({ success: false, commandes: [] }))
      )
      .subscribe((res) => {
        const active = res?.commandes?.[0];
        if (active && active.statut !== 'livree' && active.statut !== 'annulee') {
          this.activeOrder = active;
          this.loadOrderDetails(active.id);
          this.simulateDriverLocation();
        } else {
          this.activeOrder = null;
        }
        this.cdr.markForCheck();
      });
  }

  loadOrderDetails(orderId: string): void {
    this.http
      .get<any>(`${this.apiUrl}/commandes/${orderId}`, this.auth.getAuthHeaders())
      .pipe(catchError(() => of({ success: false })))
      .subscribe((res) => {
        if (res?.success && res.commande) {
          this.activeOrder = { ...this.activeOrder, ...res.commande };
          this.cdr.markForCheck();
        }
      });
  }

  simulateDriverLocation(): void {
    // Simulate driver location updates
    if (this.activeOrder) {
      this.driverLocation = {
        lat: 45.764043 + (Math.random() - 0.5) * 0.01,
        lng: 4.835659 + (Math.random() - 0.5) * 0.01
      };
      this.etaMinutes = Math.floor(Math.random() * 20) + 5;
    }
  }

  contactSupport(): void {
    this.activeTab = 'support';
    this.supportForm.patchValue({
      sujet: `Commande #${this.activeOrder?.id?.substring(0, 8)}`,
      message: ''
    });
    this.cdr.markForCheck();
  }

  // ---------- Orders History ----------
  loadOrders(): void {
    this.ordersLoading = true;
    let params = new HttpParams().set('limit', '50');
    if (this.orderFilter !== 'toutes') {
      params = params.set('statut', this.orderFilter === 'livrees' ? 'livree' : 'annulee');
    }

    this.http
      .get<any>(`${this.apiUrl}/commandes`, { params, ...this.auth.getAuthHeaders() })
      .pipe(
        catchError(() => {
          this.orders = [];
          this.ordersLoading = false;
          this.cdr.markForCheck();
          return of({ success: false, commandes: [] });
        })
      )
      .subscribe((res) => {
        this.orders = res?.commandes || [];
        this.ordersLoading = false;
        this.cdr.markForCheck();
      });
  }

  reorder(order: Order): void {
    this.toast.showToast('Commande ajoutée au panier', 'success');
    // Navigate to products page with pre-filled cart
  }

  downloadInvoice(order: Order): void {
    this.toast.showToast('Téléchargement de la facture...', 'info');
    // Generate and download invoice PDF
  }

  getStatusLabel(statut: string): string {
    const map: Record<string, string> = {
      en_attente: 'En attente',
      en_preparation: 'En préparation',
      pret_pour_livraison: 'Prêt pour livraison',
      en_livraison: 'En livraison',
      livree: 'Livrée',
      annulee: 'Annulée'
    };
    return map[statut] || statut;
  }

  getStatusBadge(statut: string): string {
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

  // ---------- Cart helpers ----------
  private loadCart(): void {
    try {
      const raw = localStorage.getItem(this.cartKey);
      if (raw) this.cart = JSON.parse(raw);
    } catch {
      this.cart = [];
    }
  }

  cartCount(): number {
    return this.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  cartTotal(): number {
    return this.cart.reduce((sum, item) => {
      const price = item.product.prix_promotion || item.product.prix;
      return sum + price * item.quantity;
    }, 0);
  }

  finalizeCart(): void {
    if (this.cartCount() === 0) {
      this.toast.showToast('Votre panier est vide.', 'info');
      return;
    }
    // Start checkout flow
    this.checkoutStep = 'address';
    this.cdr.markForCheck();
  }

  // === CHECKOUT FLOW ===

  /**
   * Step 1: Confirm address selection and gouvernorat
   */
  proceedFromAddress(): void {
    if (!this.selectedAddressId) {
      this.toast.showToast('Sélectionnez une adresse.', 'warning');
      return;
    }

    if (!this.selectedGouvernorat) {
      this.toast.showToast('Sélectionnez un gouvernorat.', 'warning');
      return;
    }

    // Extract city from selected address
    const addr = this.addresses.find(a => a.id === this.selectedAddressId);
    if (!addr) {
      this.toast.showToast('Adresse non trouvée.', 'error');
      return;
    }

    this.cartCity = addr.ville;
    this.checkoutStep = 'payment';
    this.cdr.markForCheck();
  }

  /**
   * Step 2: Validate payment method
   */
  proceedFromPayment(): void {
    if (this.paymentChoice === 'carte') {
      if (!this.isCardValid()) {
        this.toast.showToast('Veuillez remplir les informations de carte valides.', 'warning');
        return;
      }
    }
    
    // Get delivery estimate and list available livreurs
    this.loadDeliveryEstimateAndLivreurs();
    this.checkoutStep = 'livreur';
    this.cdr.markForCheck();
  }

  /**
   * Step 3: Select delivery option and proceed
   */
  proceedFromLivreur(): void {
    if (!this.selectedLivreur) {
      this.toast.showToast('Sélectionnez un livreur.', 'warning');
      return;
    }

    this.calculateOrderSummary();
    this.checkoutStep = 'summary';
    this.cdr.markForCheck();
  }

  /**
   * Step 4: Place order
   */
  confirmOrder(): void {
    if (!this.selectedAddressId || !this.selectedLivreur) {
      this.toast.showToast('Données manquantes.', 'error');
      return;
    }

    // Build order payload
    const orderPayload = {
      adresse_livraison_id: this.selectedAddressId,
      livreur_id: this.selectedLivreur.id,
      mode_paiement: this.paymentChoice,
      montant_livraison: this.orderSummary.fraisLivraison,
      instructions_speciales: '',
      // produits would be passed from parent/cart service
    };

    this.http
      .post<any>(`${this.apiUrl}/commandes`, orderPayload, this.auth.getAuthHeaders())
      .pipe(catchError(err => {
        this.toast.showToast(`Erreur: ${err.error?.message || 'Création commande échouée'}`, 'error');
        return of({ success: false });
      }))
      .subscribe(res => {
        if (res?.success) {
          // Show confirmation waiting state
          this.lastConfirmedOrderId = res.commandeId;
          this.orderConfirmationState = 'waiting';
          this.confirmationMessage = 'En attente de confirmation du livreur...';
          this.cdr.markForCheck();
          
          // Poll for confirmation every 3 seconds (max 5 minutes)
          this.pollForConfirmation();
        }
      });
  }

  /**
   * Poll for order confirmation from driver
   */
  private pollForConfirmation(): void {
    let pollCount = 0;
    const maxPolls = 100; // 5 minutes

    const pollInterval = setInterval(() => {
      if (pollCount >= maxPolls || this.orderConfirmationState !== 'waiting') {
        clearInterval(pollInterval);
        return;
      }

      this.http
        .get<any>(`${this.apiUrl}/commandes/${this.lastConfirmedOrderId}`, this.auth.getAuthHeaders())
        .pipe(catchError(() => of({ success: false })))
        .subscribe(res => {
          if (res?.success && res.data?.statut !== 'en_attente_confirmation') {
            clearInterval(pollInterval);
            this.orderConfirmationState = 'confirmed';
            this.confirmationMessage = `Le livreur a confirmé! Temps estimé: ${res.data?.temps_estime_livreur || '30'} minutes`;
            this.toast.showToast('Commande confirmée par le livreur!', 'success');
            this.cdr.markForCheck();
            
            // Auto-switch to tracking after 3 seconds
            setTimeout(() => {
              this.resetCheckout();
              this.loadOrders();
              this.activeTab = 'commande_en_cours';
            }, 3000);
          }
          pollCount++;
        });
    }, 3000);
  }

  /**
   * Load delivery estimate and available livreurs
   */
  private loadDeliveryEstimateAndLivreurs(): void {
    // 1. Estimate delivery
    this.http
      .post<any>(`${this.apiUrl}/commandes/estimer-livraison`, 
        { gouvernorat: this.selectedGouvernorat }, 
        this.auth.getAuthHeaders())
      .pipe(
        catchError(() => of({ success: false, data: { distance_km: 20, temps_estime_minutes: 30 } }))
      )
      .subscribe(res => {
        if (res?.success) {
          this.deliveryEstimate = res.data;
        }
      });

    // 2. Get available livreurs
    const params = new HttpParams().set('gouvernorat', this.selectedGouvernorat || '');
    this.http
      .get<any>(`${this.apiUrl}/commandes/livreurs-disponibles`, {
        ...this.auth.getAuthHeaders(),
        params
      })
      .pipe(
        catchError(() => of({ success: false, data: [] }))
      )
      .subscribe(res => {
        if (res?.success) {
          this.availableLivreurs = res.data;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Select a livreur and calculate delivery cost
   */
  selectLivreur(livreur: Livreur): void {
    this.selectedLivreur = livreur;
    this.cdr.markForCheck();
  }

  /**
   * Calculate final order summary
   */
  private calculateOrderSummary(): void {
    this.orderSummary.sousTotal = this.cartTotal();
    this.orderSummary.fraisService = Math.round(this.orderSummary.sousTotal * 0.05 * 100) / 100;
    
    // Delivery cost = distance * tarif_par_km
    if (this.selectedLivreur && this.deliveryEstimate) {
      this.orderSummary.fraisLivraison = 
        Math.round(this.deliveryEstimate.distance_km * this.selectedLivreur.tarif_par_km * 100) / 100;
    } else {
      this.orderSummary.fraisLivraison = 0;
    }

    this.orderSummary.total = 
      this.orderSummary.sousTotal + this.orderSummary.fraisService + this.orderSummary.fraisLivraison;
  }

  /**
   * Card validation helper
   */
  isCardValid(): boolean {
    const { numero, titulaire, expiration, cvv } = this.cardInfo;
    return !!(numero && numero.length >= 13 && titulaire && expiration && cvv);
  }

  /**
   * Get selected address
   */
  getSelectedAddress(): Address | undefined {
    return this.addresses.find(a => a.id === this.selectedAddressId);
  }

  /**
   * Reset checkout state
   */
  private resetCheckout(): void {
    this.checkoutStep = 'address';
    this.selectedAddressId = null;
    this.selectedLivreur = null;
    this.deliveryEstimate = null;
    this.cartCity = '';
    this.cardInfo = { numero: '', titulaire: '', expiration: '', cvv: '' };
    this.availableLivreurs = [];
    this.cdr.markForCheck();
  }

  private searchDeliveryOptions(): void {
    this.searchingDelivery = true;
    this.deliveryOptions = [];
    // Example call to backend (to implement server-side):
    this.http
      .get<any>(`${this.apiUrl}/livreurs/disponibles?limit=3`, this.auth.getAuthHeaders())
      .pipe(
        catchError(() =>
          of({
            success: true,
            data: [
              { livreur: 'Amine', etaMinutes: 15, price: 6.5 },
              { livreur: 'Sonia', etaMinutes: 22, price: 5.9 },
              { livreur: 'Karim', etaMinutes: 30, price: 4.8 }
            ]
          })
        )
      )
      .subscribe((res) => {
        this.deliveryOptions = res?.data || [];
        this.searchingDelivery = false;
        this.toast.showToast('Livreurs disponibles mis à jour', 'success');
        this.cdr.markForCheck();
      });
  }

  // ---------- Addresses ----------
  loadAddresses(): void {
    this.http
      .get<any>(`${this.apiUrl}/client/adresses`, this.auth.getAuthHeaders())
      .pipe(catchError(() => of({ success: false, data: [] })))
      .subscribe((res) => {
        this.addresses = res?.data || [];
        this.cdr.markForCheck();
      });
  }

  addAddress(): void {
    if (this.addressForm.invalid) {
      this.toast.showToast('Veuillez remplir tous les champs requis', 'warning');
      return;
    }

    const val = this.addressForm.value;
    this.http
      .post<any>(`${this.apiUrl}/client/adresses`, val, this.auth.getAuthHeaders())
      .subscribe({
        next: (res) => {
          if (res?.success) {
            this.toast.showToast('Adresse ajoutée', 'success');
            this.addressForm.reset();
            this.showAddressForm = false;
            this.loadAddresses();
          }
        },
        error: () => this.toast.showToast('Erreur ajout adresse', 'error')
      });
  }

  deleteAddress(id: string): void {
    if (!confirm('Supprimer cette adresse ?')) return;
    this.http.delete<any>(`${this.apiUrl}/adresses/${id}`, this.auth.getAuthHeaders()).subscribe({
      next: () => {
        this.toast.showToast('Adresse supprimée', 'success');
        this.loadAddresses();
      },
      error: () => this.toast.showToast('Erreur suppression', 'error')
    });
  }

  // ---------- Payment Methods ----------
  loadPaymentMethods(): void {
    // Mock data - replace with API call
    this.paymentMethods = [
      { id: '1', type: 'carte', numero: '****1234', nom: 'Carte principale', est_par_defaut: true },
      { id: '2', type: 'portefeuille', est_par_defaut: false }
    ];
    this.cdr.markForCheck();
  }

  addPaymentMethod(): void {
    if (this.paymentForm.invalid) {
      this.toast.showToast('Formulaire invalide', 'warning');
      return;
    }
    this.toast.showToast('Méthode de paiement ajoutée (mock)', 'info');
    this.paymentForm.reset();
    this.showPaymentForm = false;
  }

  deletePaymentMethod(id: string): void {
    if (!confirm('Supprimer cette méthode ?')) return;
    this.toast.showToast('Méthode supprimée (mock)', 'info');
  }

  // ---------- Recommendations ----------
  loadRecommendations(): void {
    // Load nearby suppliers
    this.http
      .get<any>(`${this.apiUrl}/fournisseurs?limit=10`, this.auth.getAuthHeaders())
      .pipe(catchError(() => of({ success: false, data: [] })))
      .subscribe((res) => {
        this.recommendedSuppliers = res?.data || [];
        this.cdr.markForCheck();
      });

    // Mock promotions
    this.promotions = [
      { id: '1', titre: 'Réduction 20%', description: 'Sur toutes les pizzas', code: 'PIZZA20' },
      { id: '2', titre: 'Livraison gratuite', description: 'Commande min. 30€', code: 'FREE30' }
    ];
  }

  applyPromo(code: string): void {
    this.toast.showToast(`Code ${code} appliqué`, 'success');
  }

  // ---------- Preferences ----------
  loadPreferences(): void {
    // Load from API or use defaults
    this.preferencesForm.patchValue({
      horaires_preferes: '12:00-14:00, 19:00-21:00',
      notifications_email: true,
      notifications_sms: false,
      notifications_push: true
    });
  }

  savePreferences(): void {
    if (this.preferencesForm.invalid) return;
    this.toast.showToast('Préférences sauvegardées', 'success');
  }

  toggleAllergen(allergen: string): void {
    const idx = this.selectedAllergens.indexOf(allergen);
    if (idx >= 0) {
      this.selectedAllergens.splice(idx, 1);
    } else {
      this.selectedAllergens.push(allergen);
    }
    this.cdr.markForCheck();
  }

  toggleDietary(pref: string): void {
    const idx = this.selectedDietary.indexOf(pref);
    if (idx >= 0) {
      this.selectedDietary.splice(idx, 1);
    } else {
      this.selectedDietary.push(pref);
    }
    this.cdr.markForCheck();
  }

  // ---------- Wallet ----------
  loadWallet(): void {
    this.http
      .get<any>(`${this.apiUrl}/client/profile`, this.auth.getAuthHeaders())
      .pipe(catchError(() => of({ success: false, data: {} })))
      .subscribe((res) => {
        this.walletBalance = res?.data?.portefeuille || 0;
        this.cdr.markForCheck();
      });
  }

  applyPromoCode(): void {
    if (!this.promoCode.trim()) {
      this.toast.showToast('Code promo requis', 'warning');
      return;
    }
    this.toast.showToast(`Code ${this.promoCode} appliqué`, 'success');
    this.promoCode = '';
  }

  // ---------- Support ----------
  loadTickets(): void {
    // Mock tickets
    this.tickets = [
      {
        id: '1',
        sujet: 'Problème de livraison',
        message: 'Ma commande est en retard',
        statut: 'ouvert',
        date_creation: new Date().toISOString()
      }
    ];
    this.cdr.markForCheck();
  }

  submitTicket(): void {
    if (this.supportForm.invalid) {
      this.toast.showToast('Veuillez remplir tous les champs', 'warning');
      return;
    }
    this.toast.showToast('Ticket créé', 'success');
    this.supportForm.reset();
    this.loadTickets();
  }

  sendChatMessage(): void {
    if (!this.chatDraft.trim()) return;
    this.chatMessages.push({ from: 'client', message: this.chatDraft, at: new Date() });
    this.chatDraft = '';
    // Simulate support response
    setTimeout(() => {
      this.chatMessages.push({
        from: 'support',
        message: 'Merci pour votre message. Nous traitons votre demande.',
        at: new Date()
      });
      this.cdr.markForCheck();
    }, 2000);
    this.cdr.markForCheck();
  }

  // ---------- Loyalty ----------
  loadLoyalty(): void {
    // Mock loyalty data
    this.rewards = [
      { id: '1', nom: 'Réduction 10%', points: 100, disponible: true },
      { id: '2', nom: 'Livraison gratuite', points: 200, disponible: true }
    ];
    this.pointsHistory = [
      { date: '2024-01-15', points: 50, description: 'Commande #1234' },
      { date: '2024-01-10', points: 30, description: 'Commande #1233' }
    ];
  }

  redeemReward(reward: any): void {
    if (this.loyalty.points < reward.points) {
      this.toast.showToast('Points insuffisants', 'warning');
      return;
    }
    this.toast.showToast(`Récompense "${reward.nom}" réclamée`, 'success');
    this.loyalty.points -= reward.points;
    this.cdr.markForCheck();
  }

  // ---------- Settings ----------
  loadSettings(): void {
    const user = this.auth.currentUserValue;
    if (user) {
      this.settingsForm.patchValue({
        nom_complet: user.nom_complet || '',
        telephone: user.telephone || '',
        email: user.email || ''
      });
    }
  }

  saveSettings(): void {
    if (this.settingsForm.invalid) {
      this.toast.showToast('Formulaire invalide', 'warning');
      return;
    }

    const val = this.settingsForm.value;
    if (val.mot_de_passe && val.mot_de_passe !== val.mot_de_passe_confirme) {
      this.toast.showToast('Les mots de passe ne correspondent pas', 'error');
      return;
    }

    const payload: any = {
      nom_complet: val.nom_complet,
      telephone: val.telephone
    };
    if (val.mot_de_passe) payload.mot_de_passe = val.mot_de_passe;

    this.auth.updateProfile(payload).subscribe({
      next: () => {
        this.toast.showToast('Paramètres sauvegardés', 'success');
        this.currentUser = this.auth.currentUserValue;
        this.cdr.markForCheck();
      },
      error: () => this.toast.showToast('Erreur sauvegarde', 'error')
    });
  }

  toggle2FA(): void {
    this.twoFactorEnabled = !this.twoFactorEnabled;
    this.toast.showToast(`2FA ${this.twoFactorEnabled ? 'activé' : 'désactivé'}`, 'info');
  }

  logout(): void {
    if (confirm('Déconnexion ?')) {
      this.auth.logout();
      this.router.navigate(['/login']);
    }
  }

  formatCurrency(v: number | undefined): string {
    return (v || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  }
}

