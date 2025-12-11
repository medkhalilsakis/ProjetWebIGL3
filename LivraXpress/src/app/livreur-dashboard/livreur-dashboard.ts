import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { interval, Subscription, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/authentification';
import { ToastService } from '../services/toast';
import { NotificationService, Notification } from '../services/notification';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

interface Delivery {
  id: string;
  numero_suivi?: string;
  fournisseur?: string;
  montant_total: number;
  statut: string;
  date_commande?: string;
  adresse_livraison_id?: string;
  adresse_pickup?: Address;
  adresse_livraison?: Address;
  instructions_speciales?: string;
  distance_km?: number;
  temps_estime_minutes?: number;
  client_nom?: string;
  client_telephone?: string;
}

interface Address {
  id: string;
  rue: string;
  ville: string;
  code_postal: string;
  coordonnees_gps?: { lat: number; lng: number };
}

interface LivreurProfile {
  id: string;
  nom_complet: string;
  email: string;
  telephone?: string;
  photo_profil?: string;
  type_vehicule?: string;
  numero_permis?: string;
  statut: 'disponible' | 'en_pause' | 'hors_ligne';
  note_moyenne?: number;
  nombre_livraisons?: number;
  zone_livraison?: string;
  verifie?: boolean;
}

interface Earnings {
  solde_actuel: number;
  gains_jour: number;
  gains_semaine: number;
  gains_mois: number;
  bonus: number;
  commissions: number;
}

interface Stats {
  taux_acceptation: number;
  temps_livraison_moyen: number;
  note_moyenne: number;
  nombre_livraisons: number;
  classement?: number;
  niveau?: string;
}

interface Payment {
  id: string;
  montant: number;
  date: string;
  statut: 'en_attente' | 'paye' | 'rejete';
  type: 'livraison' | 'bonus' | 'commission';
}

@Component({
  selector: 'app-livreur-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatButtonModule, MatIconModule, RouterModule],
  templateUrl: './livreur-dashboard.html',
  styleUrls: ['./livreur-dashboard.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LivreurDashboardComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef<HTMLDivElement>;
  
  private apiUrl = 'http://localhost:3000/api';

  // Gouvernorats disponibles pour zones de livraison
  readonly GOVERNORATES = [
    'Tunis','Ariana','Ben Arous','Manouba','Nabeul','Bizerte','Beja','Jendouba','Le Kef','Siliana','Sousse','Monastir','Mahdia','Kairouan','Kasserine','Sfax','Gabes','Gafsa','Tozeur','Kebili','Tataouine','Zaghouan','Sidi Bouzid','Kasserine'
  ];

  // Zones sélectionnées et tarif par km
  selectedZones: string[] = [];
  tarifParKm: number | null = null;
  private refreshSub?: Subscription;
  private locationSub?: Subscription;

  // Profile
  profile: LivreurProfile | null = null;
  currentUser: any = null;

  // Status
  status: 'disponible' | 'en_pause' | 'hors_ligne' = 'hors_ligne';

  // Active Tab
  activeTab: 'accueil' | 'commandes' | 'revenus' | 'statistiques' | 'carte' | 'support' | 'parametres' = 'accueil';

  // Deliveries
  activeDeliveries: Delivery[] = [];
  availableDeliveries: Delivery[] = [];
  deliveryHistory: Delivery[] = [];
  selectedDelivery: Delivery | null = null;
  loadingDeliveries = false;

  // Static demo pending orders (for commandes tab)
  pendingOrders: Delivery[] = [];

  // Earnings
  earnings: Earnings = {
    solde_actuel: 0,
    gains_jour: 0,
    gains_semaine: 0,
    gains_mois: 0,
    bonus: 0,
    commissions: 0
  };
  paymentHistory: Payment[] = [];
  requestingPayout = false;

  // Stats
  stats: Stats = {
    taux_acceptation: 0,
    temps_livraison_moyen: 0,
    note_moyenne: 0,
    nombre_livraisons: 0,
    classement: 0,
    niveau: 'Débutant'
  };

  // Map
  currentLocation: { lat: number; lng: number } | null = null;
  map: any = null;

  // Virtual map static points (lat/lng)
  mapDeliveries: Array<{ id: string; label: string; lat: number; lng: number; status: string }> = [];

  // Notifications
  notifications: Notification[] = [];
  unreadCount = 0;

  // Settings Forms
  vehicleForm!: FormGroup;
  availabilityForm!: FormGroup;
  documentsForm!: FormGroup;

  // UI State
  showDeliveryDetails = false;
  showPayoutForm = false;
  payoutAmount = 0;

  // Simple flag to avoid re-rendering charts many times
  private chartsRendered = false;

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

  ngOnInit(): void {
    this.initForms();
    this.loadProfile();
    this.loadAll();
    this.observeNotifications();
    this.initLocationTracking();

    // Populate static/demo content for UI testing
    this.populateStaticDemoContent();

    // Refresh every 30s
    this.refreshSub = interval(30000).subscribe(() => {
      this.loadActiveDeliveries();
      this.loadAvailableDeliveries();
    });
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
    this.locationSub?.unsubscribe();
  }

  private initForms(): void {
    this.vehicleForm = this.fb.group({
      type_vehicule: ['', Validators.required],
      numero_immatriculation: [''],
      marque: [''],
      modele: ['']
    });

    this.availabilityForm = this.fb.group({
      lundi: [true],
      mardi: [true],
      mercredi: [true],
      jeudi: [true],
      vendredi: [true],
      samedi: [true],
      dimanche: [false],
      heure_debut: ['08:00'],
      heure_fin: ['20:00']
    });

    this.documentsForm = this.fb.group({
      permis_conduire: [null],
      assurance: [null],
      carte_identite: [null]
    });
  }

  // ---------- Profile ----------
  loadProfile(): void {
    this.http.get<any>(`${this.apiUrl}/livreur/profile`, this.auth.getAuthHeaders())
      .pipe(catchError(() => of({ success: false })))
      .subscribe(res => {
        if (res?.success) {
          this.profile = res.data;
          this.status = res.data.statut || 'hors_ligne';
          // populate delivery zones and tarif
          this.selectedZones = res.data.zones_livraison || [];
          this.tarifParKm = res.data.tarif_par_km || null;
          this.cdr.markForCheck();
        }
      });
  }

  updateStatus(newStatus: 'disponible' | 'en_pause' | 'hors_ligne'): void {
    this.status = newStatus;
    // TODO: API call to update status
    this.toast.showToast(`Statut mis à jour: ${newStatus}`, 'success');
    this.cdr.markForCheck();
  }

  // Zones de livraison - toggles
  isZoneSelected(zone: string): boolean {
    return this.selectedZones.indexOf(zone) !== -1;
  }

  toggleZone(zone: string): void {
    const idx = this.selectedZones.indexOf(zone);
    if (idx === -1) {
      this.selectedZones.push(zone);
    } else {
      this.selectedZones.splice(idx, 1);
    }
    this.cdr.markForCheck();
  }

  saveDeliveryZones(): void {
    const payload: any = {
      zones_livraison: this.selectedZones,
      tarif_par_km: this.tarifParKm
    };

    this.http.patch<any>(`${this.apiUrl}/livreur/profile`, payload, this.auth.getAuthHeaders())
      .pipe(catchError(() => of({ success: false })))
      .subscribe(res => {
        if (res?.success) {
          this.toast.showToast('Zones et tarif enregistrés', 'success');
          // refresh profile
          this.loadProfile();
        } else {
          this.toast.showToast('Erreur lors de l\'enregistrement', 'error');
        }
      });
  }

  // ---------- Deliveries ----------
  loadAll(): void {
    this.loadActiveDeliveries();
    this.loadAvailableDeliveries();
    this.loadDeliveryHistory();
    this.loadEarnings();
    this.loadStats();
    this.loadPaymentHistory();
  }

  loadActiveDeliveries(): void {
    this.loadingDeliveries = true;
    this.http.get<any>(`${this.apiUrl}/livreur/commandes/actives`, this.auth.getAuthHeaders())
      .pipe(catchError(() => of({ success: false, data: [] })))
      .subscribe(res => {
        this.activeDeliveries = res?.data && res.data.length ? res.data : this.activeDeliveries;
        this.loadingDeliveries = false;
        this.cdr.markForCheck();
      });
  }

  loadAvailableDeliveries(): void {
    if (this.status !== 'disponible') return;
    
    this.http.get<any>(`${this.apiUrl}/livreur/commandes/disponibles`, this.auth.getAuthHeaders())
      .pipe(catchError(() => of({ success: false, data: [] })))
      .subscribe(res => {
        this.availableDeliveries = res?.data && res.data.length ? res.data : this.availableDeliveries;
        this.cdr.markForCheck();
      });
  }

  loadDeliveryHistory(): void {
    this.http.get<any>(`${this.apiUrl}/livreur/historique`, this.auth.getAuthHeaders())
      .pipe(catchError(() => of({ success: false, data: [] })))
      .subscribe(res => {
        this.deliveryHistory = res?.data && res.data.length ? res.data : this.deliveryHistory;
        this.cdr.markForCheck();
      });
  }

  viewDelivery(delivery: Delivery): void {
    this.selectedDelivery = delivery;
    this.showDeliveryDetails = true;
    this.loadDeliveryAddresses(delivery);
    this.cdr.markForCheck();
  }

  loadDeliveryAddresses(delivery: Delivery): void {
    // Load pickup and delivery addresses
    if (delivery.adresse_livraison_id) {
      this.http.get<any>(`${this.apiUrl}/adresses/${delivery.adresse_livraison_id}`, this.auth.getAuthHeaders())
        .pipe(catchError(() => of({ success: false })))
        .subscribe(res => {
          if (res?.success) {
            this.selectedDelivery!.adresse_livraison = res.data;
            this.cdr.markForCheck();
          }
        });
    }
  }

  acceptDelivery(deliveryId: string): void {
    this.http.post<any>(`${this.apiUrl}/livreur/commandes/${deliveryId}/accepter`, {}, this.auth.getAuthHeaders())
      .subscribe({
        next: () => {
          this.toast.showToast('Commande acceptée', 'success');
          this.loadActiveDeliveries();
          this.loadAvailableDeliveries();
          this.showDeliveryDetails = false;
        },
        error: () => this.toast.showToast('Erreur lors de l\'acceptation', 'error')
      });
  }

  rejectDelivery(deliveryId: string): void {
    if (!confirm('Refuser cette commande ?')) return;
    // TODO: API call
    this.toast.showToast('Commande refusée', 'info');
    this.loadAvailableDeliveries();
    this.showDeliveryDetails = false;
  }

  updateDeliveryStatus(deliveryId: string, newStatus: string): void {
    const location = this.currentLocation ? {
      latitude: this.currentLocation.lat,
      longitude: this.currentLocation.lng
    } : undefined;

    this.http.patch<any>(
      `${this.apiUrl}/livreur/commandes/${deliveryId}/statut`,
      { statut: newStatus, localisation: location },
      this.auth.getAuthHeaders()
    ).subscribe({
      next: () => {
        this.toast.showToast('Statut mis à jour', 'success');
        this.loadActiveDeliveries();
        this.showDeliveryDetails = false;
      },
      error: () => this.toast.showToast('Erreur mise à jour statut', 'error')
    });
  }

  // ---------- Earnings ----------
  loadEarnings(): void {
    // Mock data - replace with API
    this.earnings = {
      solde_actuel: 1250.50,
      gains_jour: 85.00,
      gains_semaine: 420.00,
      gains_mois: 1850.00,
      bonus: 150.00,
      commissions: 185.00
    };
    this.cdr.markForCheck();
  }

  loadPaymentHistory(): void {
    // Mock data - replace with API
    this.paymentHistory = [
      { id: '1', montant: 500, date: '2024-01-15', statut: 'paye', type: 'livraison' },
      { id: '2', montant: 750, date: '2024-01-08', statut: 'paye', type: 'livraison' }
    ];
    this.cdr.markForCheck();
  }

  requestPayout(): void {
    if (this.earnings.solde_actuel <= 0) {
      this.toast.showToast('Solde insuffisant', 'warning');
      return;
    }
    if (this.payoutAmount <= 0 || this.payoutAmount > this.earnings.solde_actuel) {
      this.toast.showToast('Montant invalide', 'warning');
      return;
    }

    this.requestingPayout = true;
    // TODO: API call
    setTimeout(() => {
      this.toast.showToast('Demande de virement envoyée', 'success');
      this.requestingPayout = false;
      this.showPayoutForm = false;
      this.earnings.solde_actuel -= this.payoutAmount;
      this.payoutAmount = 0;
      this.cdr.markForCheck();
    }, 1000);
  }

  // ---------- Stats ----------
  loadStats(): void {
    // Mock data - replace with API
    this.stats = {
      taux_acceptation: 92,
      temps_livraison_moyen: 18,
      note_moyenne: 4.7,
      nombre_livraisons: 156,
      classement: 12,
      niveau: 'Expert'
    };
    this.cdr.markForCheck();
  }

  // ---------- Location & Map ----------
  initLocationTracking(): void {
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (position) => {
          this.currentLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          this.cdr.markForCheck();
        },
        (error) => console.error('Geolocation error:', error),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
  }

  initMap(): void {
    // Initialize virtual SVG map using static points
    if (!this.mapContainer?.nativeElement) return;
    this.renderVirtualMap();
  }

  private renderVirtualMap(): void {
    if (!this.mapContainer?.nativeElement) return;

    // Prepare SVG canvas
    const width = 700;
    const height = 400;

    // If no points, use default demo points
    if (!this.mapDeliveries || this.mapDeliveries.length === 0) {
      this.mapDeliveries = [
        { id: 'm1', label: 'Restaurant', lat: 36.8065, lng: 10.1815, status: 'restaurant' },
        { id: 'm2', label: 'Livreur', lat: 36.8050, lng: 10.1870, status: 'livreur' },
        { id: 'm3', label: 'Client', lat: 36.8035, lng: 10.1920, status: 'client' }
      ];
    }

    // Compute bounds
    const lats = this.mapDeliveries.map(p => p.lat);
    const lngs = this.mapDeliveries.map(p => p.lng);
    const minLat = Math.min(...lats) - 0.005;
    const maxLat = Math.max(...lats) + 0.005;
    const minLng = Math.min(...lngs) - 0.005;
    const maxLng = Math.max(...lngs) + 0.005;

    const project = (lat: number, lng: number) => {
      const x = ((lng - minLng) / (maxLng - minLng || 1)) * width;
      const y = height - ((lat - minLat) / (maxLat - minLat || 1)) * height;
      return { x, y };
    };

    // Build SVG markup
    let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background:#f6f8fb;border-radius:8px;">`;

    // draw grid
    for (let i = 0; i <= 6; i++) {
      const y = (i / 6) * height;
      svg += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#e1e8f0" stroke-width="1" />`;
    }

    // draw points
    for (const p of this.mapDeliveries) {
      const pos = project(p.lat, p.lng);
      const color = p.status === 'livreur' ? '#667eea' : (p.status === 'restaurant' ? '#48bb78' : '#fc8181');
      svg += `<g transform="translate(${pos.x}, ${pos.y})">`;
      svg += `<circle cx="0" cy="0" r="12" fill="${color}" opacity="0.9"></circle>`;
      svg += `<text x="0" y="4" text-anchor="middle" font-size="12" fill="#fff">${p.status === 'livreur' ? '🚚' : p.status === 'restaurant' ? '🏪' : '📍'}</text>`;
      svg += `</g>`;
      svg += `<text x="${pos.x}" y="${pos.y + 20}" text-anchor="middle" font-size="11" fill="#2d3748">${p.label}</text>`;
    }

    // simple route (static bezier)
    if (this.mapDeliveries.length >= 2) {
      const a = project(this.mapDeliveries[0].lat, this.mapDeliveries[0].lng);
      const b = project(this.mapDeliveries[1].lat, this.mapDeliveries[1].lng);
      const c = project(this.mapDeliveries[this.mapDeliveries.length - 1].lat, this.mapDeliveries[this.mapDeliveries.length - 1].lng);
      svg += `<path d="M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - 40}, ${b.x} ${b.y} T ${c.x} ${c.y}" stroke="#667eea" stroke-width="3" fill="none" stroke-dasharray="6,6"/>`;
    }

    svg += `</svg>`;

    // Inject into DOM
    this.mapContainer.nativeElement.innerHTML = svg;
  }

  // ---------- Notifications ----------
  observeNotifications(): void {
    this.notifService.notifications$.subscribe(n => {
      this.notifications = n || [];
      this.cdr.markForCheck();
    });
    this.notifService.unreadCount$.subscribe(c => {
      this.unreadCount = c ?? 0;
      this.cdr.markForCheck();
    });
    this.notifService.loadNotifications();
  }

  // ---------- Navigation ----------
  switchTab(tab: LivreurDashboardComponent['activeTab']): void {
    this.activeTab = tab;
    if (tab === 'carte') {
      setTimeout(() => this.initMap(), 100);
    }
    if (tab === 'statistiques') {
      setTimeout(() => this.renderStaticCharts(), 100);
    }
    this.cdr.markForCheck();
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  // ---------- Helpers ----------
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2
    }).format(amount);
  }

  getStatusBadge(status: string): string {
    const map: Record<string, string> = {
      disponible: 'badge-success',
      en_pause: 'badge-warning',
      hors_ligne: 'badge-secondary',
      pret_pour_livraison: 'badge-info',
      en_livraison: 'badge-primary',
      livree: 'badge-success'
    };
    return `badge ${map[status] || 'badge-secondary'}`;
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      disponible: 'Disponible',
      en_pause: 'En pause',
      hors_ligne: 'Hors ligne',
      pret_pour_livraison: 'Prêt pour livraison',
      en_livraison: 'En livraison',
      livree: 'Livrée'
    };
    return map[status] || status;
  }

  resolveImage(url: string | null | undefined): string {
    if (!url) return 'assets/default-avatar.png';
    if (url.startsWith('http')) return url;
    return `http://localhost:3000${url.startsWith('/') ? '' : '/'}${url}`;
  }

  // ---------- Demo / Static content population ----------
  private populateStaticDemoContent(): void {
    // Static deliveries for commandes tab (pending / available)
    if (!this.availableDeliveries || this.availableDeliveries.length === 0) {
      this.availableDeliveries = [
        { id: 'avail-1', numero_suivi: 'AV-101', fournisseur: 'Chez Sami', montant_total: 12.5, statut: 'pret_pour_livraison' } as Delivery,
        { id: 'avail-2', numero_suivi: 'AV-102', fournisseur: 'La Bonne Pizza', montant_total: 18.2, statut: 'pret_pour_livraison' } as Delivery
      ];
    }

    if (!this.activeDeliveries || this.activeDeliveries.length === 0) {
      this.activeDeliveries = [
        { id: 'act-1', numero_suivi: 'AC-200', fournisseur: 'Le Bistrot', montant_total: 22.0, statut: 'en_livraison', temps_estime_minutes: 14 } as Delivery
      ];
    }

    if (!this.deliveryHistory || this.deliveryHistory.length === 0) {
      this.deliveryHistory = [
        { id: 'hist-1', numero_suivi: 'H-001', fournisseur: 'Sushi House', montant_total: 30, statut: 'livree', date_commande: new Date(Date.now() - 86400000).toISOString() } as Delivery,
        { id: 'hist-2', numero_suivi: 'H-002', fournisseur: 'La Bonne Pizza', montant_total: 18.5, statut: 'livree', date_commande: new Date(Date.now() - 172800000).toISOString() } as Delivery
      ];
    }

    // expose a "pendingOrders" property used by the UI for quick demo
    this.pendingOrders = [...this.availableDeliveries];

    // Map static points
    if (this.mapDeliveries.length === 0) {
      this.mapDeliveries = [
        { id: 'm1', label: 'Restaurant La Bonne Pizza', lat: 36.8065, lng: 10.1815, status: 'restaurant' },
        { id: 'm2', label: 'Livreur Amine', lat: 36.8052, lng: 10.1860, status: 'livreur' },
        { id: 'm3', label: 'Client Mme. A', lat: 36.8035, lng: 10.1908, status: 'client' }
      ];
    }

    // Prepare simple graph data (kept in memory; rendering happens in DOM)
    this.cdr.markForCheck();
  }

  // ---------- Simple static charts renderer (injects small SVGs into stats area) ----------
  private renderStaticCharts(): void {
    if (this.chartsRendered) return; // avoid re-rendering
    const statsContainer = document.querySelector('.stats-grid-large');
    if (!statsContainer) return;

    // Create a small bar chart for deliveries per day (static)
    const deliveriesPerDay = [3, 5, 4, 6, 7, 2, 4];
    const maxVal = Math.max(...deliveriesPerDay);
    const barWidth = 30;
    const gap = 10;
    const svgWidth = deliveriesPerDay.length * (barWidth + gap);
    const svgHeight = 120;

    let bars = `<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">`;
    deliveriesPerDay.forEach((v, i) => {
      const h = (v / (maxVal || 1)) * (svgHeight - 20);
      const x = i * (barWidth + gap);
      const y = svgHeight - h - 10;
      bars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="4" ry="4" fill="#667eea"></rect>`;
      bars += `<text x="${x + barWidth / 2}" y="${svgHeight - 2}" font-size="10" text-anchor="middle">J${i + 1}</text>`;
    });
    bars += `</svg>`;

    // line chart for earnings (static)
    const earningsSeries = [50, 80, 40, 120, 90, 60, 140];
    const eMax = Math.max(...earningsSeries);
    const lx = 300;
    const ly = 120;
    let path = '';
    earningsSeries.forEach((v, i) => {
      const x = (i / (earningsSeries.length - 1)) * (lx - 20) + 10;
      const y = ly - ((v / (eMax || 1)) * (ly - 20)) - 10;
      path += `${i === 0 ? 'M' : 'L'} ${x} ${y} `;
    });
    const lineSvg = `<svg width="${lx}" height="${ly}" viewBox="0 0 ${lx} ${ly}" xmlns="http://www.w3.org/2000/svg"><path d="${path}" fill="none" stroke="#48bb78" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;

    const wrapper = document.createElement('div');
    wrapper.className = 'static-charts';
    wrapper.style.display = 'flex';
    wrapper.style.gap = '16px';
    wrapper.innerHTML = `<div class="chart-card"><h4>Livraisons / jour</h4>${bars}</div><div class="chart-card"><h4>Gains (simulés)</h4>${lineSvg}</div>`;

    statsContainer.appendChild(wrapper);
    this.chartsRendered = true;
  }
}
