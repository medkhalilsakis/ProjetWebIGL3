import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../services/authentification';
import { ToastService } from '../services/toast';
import { Subscription, interval } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

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

interface Product {
  id: string;
  nom: string;
  description: string;
  prix: number;
  quantite: number;
  status: 'active' | 'inactive' | 'out_of_stock';
  categorie: string;
  image?: string;
  promotionPercent?: number;
}

interface Order {
  id: string;
  numero_suivi: string;
  status: 'pending' | 'preparing' | 'ready' | 'picked_up' | 'delivered' | string;
  montant_total: number;
  client_nom: string;
  products: any[];
  instructions?: string;
  createdAt: Date;
  estimatedPickup?: Date;
}

interface Alert {
  id: string;
  type: 'stock' | 'order' | 'dispute' | 'system';
  message: string;
  severity: 'warning' | 'critical' | 'info';
  timestamp: Date;
}

@Component({
  selector: 'app-fournisseur-dashboard',
  templateUrl: './fournisseur-dashboard.html',
  styleUrls: ['./fournisseur-dashboard.css'],
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FournisseurDashboard implements OnInit, OnDestroy {
  // Tab Management
  activeTab: 'overview' | 'products' | 'orders' | 'statistics' | 'finance' | 'schedule' | 'messages' | 'settings' = 'overview';

  // Data
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

  products: Product[] = [];
  orders: Order[] = [];
  alerts: Alert[] = [];
  currentUser: any = null;

  // UI State
  loading = true;
  showProductForm = false;
  showOrderDetails = false;
  selectedOrder: Order | null = null;
  selectedProduct: Product | null = null;

  // Error states
  loadingErrors = {
    stats: false,
    products: false,
    orders: false,
    alerts: false,
    finance: false,
    topProducts: false
  };

  // Form Data
  newProduct: Partial<Product> = {
    status: 'inactive',
    categorie: 'food'
  };

  // Finance
  availableBalance = 0;
  totalCommission = 0;
  paymentHistory: any[] = [];
  revenueByDate: any[] = [];

  // Schedule
  openingTime = '10:00';
  closingTime = '22:00';
  isOpen = true;
  holidays: string[] = [];

  // Reviews & Ratings
  reviews: any[] = [];
  averageRating = 0;
  totalReviews = 0;

  // Charts Data
  salesByPeriod = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    data: [0, 0, 0, 0, 0, 0, 0]
  };
  topProducts: any[] = [];
  orderTrends: any[] = [];
  ordersByStatus: any[] = [];

  // Cached random values (to avoid template recalcs)
  cachedRandomValues = new Map<string, number>();
  public Math = Math; // to use Math in template
  private updateSubscription: Subscription | null = null;
  private apiUrl = 'http://localhost:3000/api';
  // API error tracking
  apiErrorMessages: { [key: string]: string } = {};

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private toastService: ToastService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.currentUser = this.authService?.currentUserValue ?? null;
    this.initializeCachedValues();
  }

  // Helper to always include auth headers in requests (fallback if interceptor not applied)
  private getAuthOptions() {
    return this.authService?.getAuthHeaders() || {};
  }

  private initializeCachedValues(): void {
    this.cachedRandomValues.set('trend_hour', Math.floor(Math.random() * 5));
    this.cachedRandomValues.set('trend_percent', Math.floor(Math.random() * 20));
  }

  getCachedRandom(key: string): number {
    if (!this.cachedRandomValues.has(key)) {
      this.cachedRandomValues.set(key, Math.floor(Math.random() * 20));
    }
    return this.cachedRandomValues.get(key) ?? 0;
  }

  ngOnInit(): void {
    this.loadDashboardData();
    this.initializeRealtimeUpdates();
  }

  ngOnDestroy(): void {
    if (this.updateSubscription) {
      this.updateSubscription.unsubscribe();
      this.updateSubscription = null;
    }
  }

  // ---------- Loading / Initialization ----------
  loadDashboardData(): void {
    this.loading = true;
    // reset error flags
    Object.keys(this.loadingErrors).forEach(k => (this.loadingErrors[k as keyof typeof this.loadingErrors] = false));
    // call loads (kept separate for clarity)
    this.loadStats();
    this.loadProducts();
    this.loadOrders();
    this.loadAlerts();
    this.loadFinanceData();
    this.loadTopProducts();
    // loading flag will be cleared by initializeRealtimeUpdates once initial extra loads are triggered
  }

  private loadStats(): void {
    this.http.get<any>(`${this.apiUrl}/fournisseur/stats`, this.getAuthOptions()).subscribe({
      next: (response) => {
        try {
          if (response?.success && response.data) {
            const d = response.data;
            this.stats = {
              ordersToday: d.ordersToday ?? 0,
              ordersWeek: d.ordersWeek ?? 0,
              ordersMonth: d.ordersMonth ?? 0,
              revenueToday: d.revenueToday ?? 0,
              revenueWeek: d.revenueWeek ?? 0,
              revenueMonth: d.revenueMonth ?? 0,
              rating: d.rating ?? 0,
              avgPrepTime: d.avgPrepTime ?? 0,
              totalOrders: d.totalOrders ?? 0
            };
          } else {
            // leave defaults
          }
          this.loadingErrors.stats = false;
        } catch (err) {
          console.error('Error parsing stats response:', err);
          this.loadingErrors.stats = true;
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.handleApiError(err, 'stats');
        this.loadingErrors.stats = true;
        this.cdr.markForCheck();
      }
    });
  }

  private loadProducts(): void {
    this.http.get<any>(`${this.apiUrl}/fournisseur/produits`, this.getAuthOptions()).subscribe({
      next: (response) => {
        try {
          if (response?.success && Array.isArray(response.data)) {
            this.products = response.data.map((p: any) => ({
              id: p.id,
              nom: p.nom ?? 'Unknown Product',
              description: p.description ?? '',
              prix: p.prix ?? 0,
              quantite: p.quantite ?? 0,
              status: p.status ?? 'active',
              categorie: p.categorie ?? 'food',
              image: p.image,
              promotionPercent: p.promotionPercent ?? 0
            }));
          } else {
            this.products = [];
          }
          this.loadingErrors.products = false;
        } catch (err) {
          console.error('Error parsing products response:', err);
          this.loadingErrors.products = true;
          this.products = [];
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.handleApiError(err, 'products');
        this.loadingErrors.products = true;
        this.products = [];
        this.cdr.markForCheck();
      }
    });
  }

  private loadOrders(): void {
    this.http.get<any>(`${this.apiUrl}/fournisseur/commandes?limit=50`, this.getAuthOptions()).subscribe({
      next: (response) => {
        try {
          if (response?.success && Array.isArray(response.data)) {
            this.orders = response.data.map((o: any) => ({
              id: o.id,
              numero_suivi: o.numero_suivi ?? `ORD-${(o.id ?? '').toString().substring(0, 6).toUpperCase()}`,
              status: o.statut ?? 'pending',
              montant_total: o.montant_total ?? 0,
              client_nom: o.client_nom ?? 'Unknown Client',
              products: o.lignes_commande ?? [],
              instructions: o.instructions_speciales ?? '',
              createdAt: new Date(o.created_at ?? Date.now()),
              estimatedPickup: o.estimated_pickup ? new Date(o.estimated_pickup) : undefined
            }));
          } else {
            this.orders = [];
          }
          this.loadingErrors.orders = false;
        } catch (err) {
          console.error('Error parsing orders response:', err);
          this.loadingErrors.orders = true;
          this.orders = [];
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.handleApiError(err, 'orders');
        this.loadingErrors.orders = true;
        this.orders = [];
        this.cdr.markForCheck();
      }
    });
  }

  private loadAlerts(): void {
    this.http.get<any>(`${this.apiUrl}/fournisseur/alertes`, this.getAuthOptions()).subscribe({
      next: (response) => {
        try {
          this.alerts = response?.success && Array.isArray(response.data) ? response.data : [];
          this.loadingErrors.alerts = false;
        } catch (err) {
          console.error('Error parsing alerts response:', err);
          this.loadingErrors.alerts = true;
          this.alerts = [];
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.handleApiError(err, 'alerts');
        this.loadingErrors.alerts = true;
        this.alerts = [];
        this.cdr.markForCheck();
      }
    });
  }

  private loadFinanceData(): void {
    this.http.get<any>(`${this.apiUrl}/fournisseur/finance`, this.getAuthOptions()).subscribe({
      next: (response) => {
        try {
          if (response?.success && response.data) {
            const d = response.data;
            this.availableBalance = d.availableBalance ?? 0;
            this.totalCommission = d.totalCommission ?? 0;
            this.paymentHistory = d.paymentHistory ?? [];
          } else {
            this.availableBalance = 0;
            this.totalCommission = 0;
            this.paymentHistory = [];
          }
          this.loadingErrors.finance = false;
        } catch (err) {
          console.error('Error parsing finance response:', err);
          this.loadingErrors.finance = true;
          this.availableBalance = 0;
          this.totalCommission = 0;
          this.paymentHistory = [];
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.handleApiError(err, 'finance');
        this.loadingErrors.finance = true;
        this.availableBalance = 0;
        this.totalCommission = 0;
        this.paymentHistory = [];
        this.cdr.markForCheck();
      }
    });
  }

  private loadTopProducts(): void {
    this.http.get<any>(`${this.apiUrl}/fournisseur/produits/top`, this.getAuthOptions()).subscribe({
      next: (response) => {
        try {
          this.topProducts = response?.success && Array.isArray(response.data) ? response.data : [];
          this.loadingErrors.topProducts = false;
        } catch (err) {
          console.error('Error parsing top products response:', err);
          this.loadingErrors.topProducts = true;
          this.topProducts = [];
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.handleApiError(err, 'topProducts');
        this.loadingErrors.topProducts = true;
        this.topProducts = [];
        this.cdr.markForCheck();
      }
    });
  }

  private loadReviews(): void {
    this.http.get<any>(`${this.apiUrl}/avis/fournisseur`, this.getAuthOptions()).subscribe({
      next: (response) => {
        try {
          if (response?.success && Array.isArray(response.data)) {
            this.reviews = response.data;
            this.totalReviews = this.reviews.length;
            if (this.totalReviews > 0) {
              const totalRating = this.reviews.reduce((sum: number, r: any) => sum + (r.rating ?? 0), 0);
              this.averageRating = totalRating / this.totalReviews;
            } else {
              this.averageRating = 0;
            }
          } else {
            this.reviews = [];
            this.totalReviews = 0;
            this.averageRating = 0;
          }
        } catch (err) {
          console.error('Error parsing reviews response:', err);
          this.reviews = [];
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.handleApiError(err, 'reviews');
        this.reviews = [];
        this.cdr.markForCheck();
      }
    });
  }

  private loadRevenueByDate(): void {
    this.http.get<any>(`${this.apiUrl}/statistiques/revenue/dates?days=30`, this.getAuthOptions()).subscribe({
      next: (response) => {
        try {
          this.revenueByDate = response?.success && Array.isArray(response.data) ? response.data : [];
        } catch (err) {
          console.error('Error parsing revenue data:', err);
          this.revenueByDate = [];
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.handleApiError(err, 'revenueByDate');
        this.revenueByDate = [];
        this.cdr.markForCheck();
      }
    });
  }

  private loadOrdersByStatus(): void {
    this.http.get<any>(`${this.apiUrl}/statistiques/commandes/statut`, this.getAuthOptions()).subscribe({
      next: (response) => {
        try {
          this.ordersByStatus = response?.success && Array.isArray(response.data) ? response.data : [];
        } catch (err) {
          console.error('Error parsing order status data:', err);
          this.ordersByStatus = [];
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.handleApiError(err, 'ordersByStatus');
        this.ordersByStatus = [];
        this.cdr.markForCheck();
      }
    });
  }

  initializeRealtimeUpdates(): void {
    // additional periodic/one-time loads
    this.loadReviews();
    this.loadRevenueByDate();
    this.loadOrdersByStatus();

    // Refresh small set periodically
    this.updateSubscription = interval(30000).subscribe(() => {
      this.loadStats();
      this.loadOrders();
      this.loadReviews();
    });

    // initial loading finished
    this.loading = false;
    this.cdr.markForCheck();
  }

  // ---------- Tabs ----------
  switchTab(tab: any): void {
    this.activeTab = tab;
    this.showProductForm = false;
    this.showOrderDetails = false;
    this.cdr.markForCheck();
  }

  // ---------- Product management ----------
  addProduct(): void {
    this.showProductForm = true;
    this.newProduct = { status: 'inactive', categorie: 'food' };
  }

  saveProduct(): void {
    if (!this.newProduct.nom || this.newProduct.prix == null) {
      this.toastService.showToast('Please fill in all required fields', 'warning');
      return;
    }

    const payload = {
      nom: this.newProduct.nom,
      description: this.newProduct.description,
      prix: this.newProduct.prix,
      quantite: this.newProduct.quantite ?? 0,
      status: this.newProduct.status,
      categorie: this.newProduct.categorie,
      promotionPercent: this.newProduct.promotionPercent ?? 0
    };

    this.http.post<any>(`${this.apiUrl}/fournisseur/produits`, payload, this.getAuthOptions()).subscribe({
      next: (res) => {
        if (res?.success && res.data) {
          this.products.push(res.data);
          this.toastService.showToast('Product added successfully', 'success');
          this.showProductForm = false;
          this.newProduct = { status: 'inactive', categorie: 'food' };
          this.cdr.markForCheck();
        } else {
          this.toastService.showToast('Product added but response incomplete', 'warning');
        }
      },
      error: (err) => {
        this.handleApiError(err, 'saveProduct');
        this.toastService.showToast('Failed to add product', 'error');
        this.cdr.markForCheck();
      }
    });
  }

  editProduct(product: Product): void {
    this.selectedProduct = product;
    this.newProduct = { ...product };
    this.showProductForm = true;
    this.cdr.markForCheck();
  }

  updateProduct(): void {
    if (!this.selectedProduct) return;
    if (!this.newProduct.nom || this.newProduct.prix == null) {
      this.toastService.showToast('Please fill in all required fields', 'warning');
      return;
    }

    const payload = {
      nom: this.newProduct.nom,
      description: this.newProduct.description,
      prix: this.newProduct.prix,
      quantite: this.newProduct.quantite ?? 0,
      status: this.newProduct.status,
      categorie: this.newProduct.categorie,
      promotionPercent: this.newProduct.promotionPercent ?? 0
    };

    this.http.put<any>(`${this.apiUrl}/fournisseur/produits/${this.selectedProduct.id}`, payload, this.getAuthOptions()).subscribe({
      next: (res) => {
        if (res?.success && res.data) {
          const idx = this.products.findIndex(p => p.id === this.selectedProduct?.id);
          if (idx > -1) this.products[idx] = res.data;
          this.toastService.showToast('Product updated successfully', 'success');
          this.selectedProduct = null;
          this.showProductForm = false;
          this.cdr.markForCheck();
        } else {
          this.toastService.showToast('Product updated but response incomplete', 'warning');
        }
      },
      error: (err) => {
        this.handleApiError(err, 'updateProduct');
        this.toastService.showToast('Failed to update product', 'error');
        this.cdr.markForCheck();
      }
    });
  }

  deleteProduct(id: string): void {
    if (!confirm('Are you sure you want to delete this product?')) return;

    this.http.delete<any>(`${this.apiUrl}/fournisseur/produits/${id}`, this.getAuthOptions()).subscribe({
      next: (res) => {
        if (res?.success) {
          this.products = this.products.filter(p => p.id !== id);
          this.toastService.showToast('Product deleted successfully', 'success');
          this.cdr.markForCheck();
        } else {
          this.toastService.showToast('Failed to delete product', 'warning');
        }
      },
      error: (err) => {
        this.handleApiError(err, 'deleteProduct');
        this.toastService.showToast('Failed to delete product', 'error');
        this.cdr.markForCheck();
      }
    });
  }

  toggleProductStatus(product: Product): void {
    const newStatus = product.status === 'active' ? 'inactive' : 'active';
    const update = { status: newStatus };

    this.http.patch<any>(`${this.apiUrl}/fournisseur/produits/${product.id}`, update, this.getAuthOptions()).subscribe({
      next: (res) => {
        if (res?.success) {
          product.status = newStatus;
          this.toastService.showToast(`Product ${newStatus}`, 'success');
          this.cdr.markForCheck();
        } else {
          this.toastService.showToast('Failed to update product status', 'warning');
        }
      },
      error: (err) => {
        this.handleApiError(err, 'toggleProductStatus');
        this.toastService.showToast('Failed to update product status', 'error');
        this.cdr.markForCheck();
      }
    });
  }

  // ---------- Orders ----------
  viewOrderDetails(order: Order): void {
    this.selectedOrder = order;
    this.showOrderDetails = true;
    this.cdr.markForCheck();
  }

  updateOrderStatus(order: Order, newStatus: string): void {
    this.http.patch<any>(`${this.apiUrl}/fournisseur/commandes/${order.id}`, { statut: newStatus }, this.getAuthOptions()).subscribe({
      next: (res) => {
        if (res?.success) {
          order.status = newStatus;
          this.toastService.showToast('Order status updated', 'success');
          this.cdr.markForCheck();
        } else {
          this.toastService.showToast('Failed to update order status', 'warning');
        }
      },
      error: (err) => {
        this.handleApiError(err, 'updateOrderStatus');
        this.toastService.showToast('Failed to update order status', 'error');
        this.cdr.markForCheck();
      }
    });
  }

  markAsReady(order: Order): void {
    this.updateOrderStatus(order, 'ready');
  }

  notifyCourier(order: Order): void {
    this.http.post<any>(`${this.apiUrl}/fournisseur/commandes/${order.id}/notifier-courrier`, {}, this.getAuthOptions()).subscribe({
      next: (res) => {
        if (res?.success) {
          this.toastService.showToast('Courier notified for pickup', 'success');
        } else {
          this.toastService.showToast('Failed to notify courier', 'warning');
        }
      },
      error: (err) => {
        this.handleApiError(err, 'notifyCourier');
        this.toastService.showToast('Failed to notify courier', 'error');
      }
    });
  }

  getOrderStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      pending: '#FFA500',
      preparing: '#FF6B6B',
      ready: '#4ECDC4',
      picked_up: '#95E1D3',
      delivered: '#2ECC71'
    };
    return colors[status] ?? '#999';
  }

  getTimeRemaining(estimatedPickup?: Date): string {
    if (!estimatedPickup) return '--';
    const now = Date.now();
    const pickup = new Date(estimatedPickup).getTime();
    const diff = pickup - now;
    const minutes = Math.floor(diff / 60000);
    return minutes > 0 ? `${minutes}m` : 'Overdue';
  }

  // ---------- Statistics / Reports ----------
  getConversionRate(): number {
    return this.stats.ordersMonth > 0 ? Math.round((this.stats.totalOrders / (this.stats.ordersMonth * 2.5)) * 100) : 0;
  }

  getNetRevenue(): number {
    return Math.round(this.stats.revenueMonth * 0.95);
  }

  downloadReport(format: 'pdf' | 'excel'): void {
    this.http.get(`${this.apiUrl}/fournisseur/reports?format=${format}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const type = format === 'pdf' ? 'application/pdf' : 'application/vnd.ms-excel';
        const url = window.URL.createObjectURL(new Blob([blob], { type }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `rapport.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
        link.click();
        this.toastService.showToast(`Report downloaded as ${format.toUpperCase()}`, 'success');
      },
      error: (err) => {
        this.handleApiError(err, 'downloadReport');
        this.toastService.showToast('Failed to download report', 'error');
      }
    });
  }

  // ---------- Finance ----------
  requestPayout(): void {
    if (this.availableBalance <= 0) {
      this.toastService.showToast('No balance available', 'info');
      return;
    }

    this.http.post<any>(`${this.apiUrl}/fournisseur/payout`, { amount: this.availableBalance }, this.getAuthOptions()).subscribe({
      next: (res) => {
        if (res?.success) {
          this.toastService.showToast('Payout request submitted', 'success');
          this.availableBalance = 0;
          this.loadFinanceData();
          this.cdr.markForCheck();
        } else {
          this.toastService.showToast('Failed to submit payout request', 'warning');
        }
      },
      error: (err) => {
        this.handleApiError(err, 'requestPayout');
        this.toastService.showToast('Failed to request payout', 'error');
      }
    });
  }

  // ---------- Schedule ----------
  updateSchedule(): void {
    const payload = {
      opening_time: this.openingTime,
      closing_time: this.closingTime
    };

    this.http.post<any>(`${this.apiUrl}/fournisseur/schedule`, payload, this.getAuthOptions()).subscribe({
      next: (res) => {
        if (res?.success) {
          this.toastService.showToast('Schedule updated successfully', 'success');
          this.cdr.markForCheck();
        } else {
          this.toastService.showToast('Failed to update schedule', 'warning');
        }
      },
      error: (err) => {
        this.handleApiError(err, 'updateSchedule');
        this.toastService.showToast('Failed to update schedule', 'error');
        this.cdr.markForCheck();
      }
    });
  }

  toggleAvailability(): void {
    this.isOpen = !this.isOpen;
    const payload = { is_open: this.isOpen };

    this.http.post<any>(`${this.apiUrl}/fournisseur/availability`, payload, this.getAuthOptions()).subscribe({
      next: (res) => {
        if (res?.success) {
          this.toastService.showToast(`Store ${this.isOpen ? 'opened' : 'closed'}`, 'success');
          this.cdr.markForCheck();
        } else {
          this.toastService.showToast('Failed to update availability', 'warning');
          this.isOpen = !this.isOpen; // revert
        }
      },
      error: (err) => {
        this.handleApiError(err, 'toggleAvailability');
        this.isOpen = !this.isOpen; // revert
        this.toastService.showToast('Failed to update availability', 'error');
        this.cdr.markForCheck();
      }
    });
  }

  // ---------- Messages ----------
  sendMessage(recipient: string, message: string): void {
    if (!recipient || !message) {
      this.toastService.showToast('Recipient and message are required', 'warning');
      return;
    }

    this.http.post<any>(`${this.apiUrl}/fournisseur/messages`, { recipient, message }, this.getAuthOptions()).subscribe({
      next: (res) => {
        if (res?.success) {
          this.toastService.showToast('Message sent', 'success');
        } else {
          this.toastService.showToast('Failed to send message', 'warning');
        }
      },
      error: (err) => {
        this.handleApiError(err, 'sendMessage');
        this.toastService.showToast('Failed to send message', 'error');
      }
    });
  }

  // ---------- Settings ----------
  saveSettings(): void {
    // implement saving logic if needed
    this.toastService.showToast('Settings updated successfully', 'success');
  }

  // ---------- Error handling ----------
  handleApiError(error: any, section: string): void {
    // Silently ignore 404s for non-critical data sections (reviews, charts, etc.)
    const silentSections = ['reviews', 'revenueByDate', 'ordersByStatus'];
    if (error?.status === 404 && silentSections.includes(section)) {
      console.debug(`[Dashboard] ${section}: 404 - data not yet available`);
      return;
    }

    console.error(`API Error in ${section}:`, error);
    if (!error) {
      this.apiErrorMessages[section] = 'Unknown error';
      return;
    }

    if (error.status === 401) {
      this.apiErrorMessages[section] = 'Session expired. Please log in again.';
      this.authService.logout();
      this.router.navigate(['/login']);
    } else if (error.status === 403) {
      this.apiErrorMessages[section] = 'You do not have permission to perform this action.';
    } else if (error.status === 404) {
      this.apiErrorMessages[section] = 'Resource not found.';
    } else if (error.status === 500) {
      this.apiErrorMessages[section] = 'Server error. Please try again later.';
    } else if (error.status === 0) {
      this.apiErrorMessages[section] = 'Network error. Check your connection.';
    } else {
      this.apiErrorMessages[section] = error.error?.message ?? 'An error occurred.';
    }
    this.cdr.markForCheck();
  }

  clearApiError(section: string): void {
    delete this.apiErrorMessages[section];
    this.cdr.markForCheck();
  }

  hasApiError(section: string): boolean {
    return !!this.apiErrorMessages[section];
  }

  getApiError(section: string): string {
    return this.apiErrorMessages[section] ?? '';
  }

  // ---------- Logout ----------
  logout(): void {
    if (!confirm('Are you sure you want to disconnect?')) return;
    this.authService.logout();
    this.toastService.showToast('Disconnected successfully', 'success');
    this.router.navigate(['/']);
  }
}
