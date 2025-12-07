import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { AuthService } from '../services/authentification';
import { ToastService } from '../services/toast';

interface AdminUser {
  id: string;
  email: string;
  nom_complet: string;
  role: string;
}

interface Driver {
  id: string;
  nom_complet: string;
  email: string;
  statut: 'pending' | 'active' | 'suspended' | 'rejected';
  rating?: number;
  deliveries_completed?: number;
  documents_status?: string;
}

interface Customer {
  id: string;
  nom_complet: string;
  email: string;
  status: 'active' | 'inactive' | 'suspended' | 'fraudulent';
  orders_count?: number;
}

interface Delivery {
  id: string;
  numero_suivi: string;
  driver_id?: string;
  customer_id?: string;
  status: 'pending' | 'ongoing' | 'delivered' | 'cancelled';
  montant_total?: number;
  created_at?: string;
}

interface FinancialData {
  daily_revenue: number;
  weekly_revenue: number;
  total_payouts: number;
  pending_payouts: number;
}

interface AnalyticsData {
  deliveries_today: number;
  avg_delivery_time: number;
  cancellation_rate: number;
  customer_satisfaction: number;
}

interface SystemNotification {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
}

interface SupportTicket {
  id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminDashboard implements OnInit, OnDestroy {
  public apiUrl = 'http://localhost:3000/api';

  // Active tab
  activeTab: string = 'overview';

  // Users
  drivers: Driver[] = [];
  customers: Customer[] = [];
  adminUsers: AdminUser[] = [];

  // Deliveries
  deliveries: Delivery[] = [];
  ongoingCount = 0;
  deliveredCount = 0;

  // Financials
  financial: FinancialData = { daily_revenue: 0, weekly_revenue: 0, total_payouts: 0, pending_payouts: 0 };

  // Analytics
  analytics: AnalyticsData = { deliveries_today: 0, avg_delivery_time: 0, cancellation_rate: 0, customer_satisfaction: 0 };

  // Notifications
  systemNotifications: SystemNotification[] = [];

  // Support
  tickets: SupportTicket[] = [];

  // Config
  deliveryPricing = { base: 2.5, per_km: 0.5, peak_multiplier: 1.5 };
  serviceZones: string[] = ['Lyon', 'Paris', 'Marseille'];
  promoCodes: { code: string; discount: number }[] = [];

  // UI
  loading = true;
  selectedDriver: Driver | null = null;
  selectedCustomer: Customer | null = null;
  selectedDelivery: Delivery | null = null;

  // Forms
  newPromoCode = '';
  newPromoDiscount = 0;
  newServiceZone = '';

  private updateSub: Subscription | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  // Helper to include auth headers (fallback)
  private getAuthOptions() {
    return this.authService?.getAuthHeaders() || {};
  }

  ngOnInit(): void {
    this.loadAll();
    this.updateSub = interval(30000).subscribe(() => this.loadDelta());
  }

  ngOnDestroy(): void {
    if (this.updateSub) this.updateSub.unsubscribe();
  }

  // ---------- Loading ----------
  loadAll(): void {
    this.loading = true;
    this.loadDrivers();
    this.loadCustomers();
    this.loadDeliveries();
    this.loadFinancials();
    this.loadAnalytics();
    this.loadNotifications();
    this.loadTickets();
    this.loading = false;
    this.cdr.markForCheck();
  }

  loadDelta(): void {
    this.loadDeliveries();
    this.loadFinancials();
    this.loadNotifications();
    this.cdr.markForCheck();
  }

  private loadDrivers(): void {
    this.http.get<any>(`${this.apiUrl}/admin/drivers`, this.getAuthOptions()).subscribe({
      next: res => {
        if (res?.success && Array.isArray(res.data)) this.drivers = res.data;
        this.cdr.markForCheck();
      },
      error: () => {
        this.drivers = this.mockDrivers();
        this.cdr.markForCheck();
      }
    });
  }

  private loadCustomers(): void {
    this.http.get<any>(`${this.apiUrl}/admin/customers`, this.getAuthOptions()).subscribe({
      next: res => {
        if (res?.success && Array.isArray(res.data)) this.customers = res.data;
        this.cdr.markForCheck();
      },
      error: () => {
        this.customers = this.mockCustomers();
        this.cdr.markForCheck();
      }
    });
  }

  private loadDeliveries(): void {
    this.http.get<any>(`${this.apiUrl}/admin/deliveries`, this.getAuthOptions()).subscribe({
      next: res => {
        if (res?.success && Array.isArray(res.data)) {
          this.deliveries = res.data;
          this.ongoingCount = res.data.filter((d: any) => d.status === 'ongoing').length;
          this.deliveredCount = res.data.filter((d: any) => d.status === 'delivered').length;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.deliveries = this.mockDeliveries();
        this.cdr.markForCheck();
      }
    });
  }

  private loadFinancials(): void {
    this.http.get<any>(`${this.apiUrl}/admin/financials`, this.getAuthOptions()).subscribe({
      next: res => {
        if (res?.success && res.data) this.financial = res.data;
        this.cdr.markForCheck();
      },
      error: () => {
        this.financial = { daily_revenue: 1240.5, weekly_revenue: 8560.2, total_payouts: 6200.0, pending_payouts: 850.0 };
        this.cdr.markForCheck();
      }
    });
  }

  private loadAnalytics(): void {
    this.http.get<any>(`${this.apiUrl}/admin/analytics`, this.getAuthOptions()).subscribe({
      next: res => {
        if (res?.success && res.data) this.analytics = res.data;
        this.cdr.markForCheck();
      },
      error: () => {
        this.analytics = { deliveries_today: 342, avg_delivery_time: 28, cancellation_rate: 2.3, customer_satisfaction: 94 };
        this.cdr.markForCheck();
      }
    });
  }

  private loadNotifications(): void {
    this.http.get<any>(`${this.apiUrl}/admin/notifications`, this.getAuthOptions()).subscribe({
      next: res => {
        if (res?.success && Array.isArray(res.data)) this.systemNotifications = res.data;
        this.cdr.markForCheck();
      },
      error: () => {
        this.systemNotifications = [
          { id: '1', title: 'Peak Hour Alert', message: 'High demand in Lyon zone', severity: 'info', timestamp: new Date().toISOString() }
        ];
        this.cdr.markForCheck();
      }
    });
  }

  private loadTickets(): void {
    this.http.get<any>(`${this.apiUrl}/admin/support/tickets`, this.getAuthOptions()).subscribe({
      next: res => {
        if (res?.success && Array.isArray(res.data)) this.tickets = res.data;
        this.cdr.markForCheck();
      },
      error: () => {
        this.tickets = [
          { id: 't1', subject: 'Missing delivery', status: 'open', priority: 'high', created_at: new Date().toISOString() }
        ];
        this.cdr.markForCheck();
      }
    });
  }

  // ---------- Driver Management ----------
  approveDriver(driver: Driver): void {
    this.http.post<any>(`${this.apiUrl}/admin/drivers/${driver.id}/approve`, {}, this.getAuthOptions()).subscribe({
      next: () => {
        driver.statut = 'active';
        this.toast.showToast('Driver approved', 'success');
        this.cdr.markForCheck();
      },
      error: () => this.toast.showToast('Failed to approve driver', 'error')
    });
  }

  suspendDriver(driver: Driver): void {
    this.http.post<any>(`${this.apiUrl}/admin/drivers/${driver.id}/suspend`, {}, this.getAuthOptions()).subscribe({
      next: () => {
        driver.statut = 'suspended';
        this.toast.showToast('Driver suspended', 'success');
        this.cdr.markForCheck();
      },
      error: () => this.toast.showToast('Failed to suspend driver', 'error')
    });
  }

  // ---------- Delivery Management ----------
  reassignDelivery(delivery: Delivery, newDriverId: string): void {
    this.http.post<any>(`${this.apiUrl}/admin/deliveries/${delivery.id}/reassign`, { driver_id: newDriverId }, this.getAuthOptions()).subscribe({
      next: () => {
        delivery.driver_id = newDriverId;
        this.toast.showToast('Delivery reassigned', 'success');
        this.cdr.markForCheck();
      },
      error: () => this.toast.showToast('Failed to reassign', 'error')
    });
  }

  cancelDelivery(delivery: Delivery): void {
    this.http.post<any>(`${this.apiUrl}/admin/deliveries/${delivery.id}/cancel`, {}, this.getAuthOptions()).subscribe({
      next: () => {
        delivery.status = 'cancelled';
        this.toast.showToast('Delivery cancelled', 'success');
        this.cdr.markForCheck();
      },
      error: () => this.toast.showToast('Failed to cancel delivery', 'error')
    });
  }

  // ---------- Configuration ----------
  saveDeliveryPricing(): void {
    this.http.post<any>(`${this.apiUrl}/admin/config/pricing`, this.deliveryPricing, this.getAuthOptions()).subscribe({
      next: () => this.toast.showToast('Pricing updated', 'success'),
      error: () => this.toast.showToast('Failed to save pricing', 'error')
    });
  }

  addServiceZone(): void {
    if (!this.newServiceZone) return;
    this.serviceZones.push(this.newServiceZone);
    this.http.post<any>(`${this.apiUrl}/admin/config/zones`, { zone: this.newServiceZone }, this.getAuthOptions()).subscribe({
      next: () => {
        this.toast.showToast('Zone added', 'success');
        this.newServiceZone = '';
        this.cdr.markForCheck();
      },
      error: () => this.toast.showToast('Failed to add zone', 'error')
    });
  }

  addPromoCode(): void {
    if (!this.newPromoCode || this.newPromoDiscount <= 0) return;
    const promo = { code: this.newPromoCode, discount: this.newPromoDiscount };
    this.promoCodes.push(promo);
    this.http.post<any>(`${this.apiUrl}/admin/config/promos`, promo, this.getAuthOptions()).subscribe({
      next: () => {
        this.toast.showToast('Promo code added', 'success');
        this.newPromoCode = '';
        this.newPromoDiscount = 0;
        this.cdr.markForCheck();
      },
      error: () => this.toast.showToast('Failed to add promo', 'error')
    });
  }

  // ---------- Notifications ----------
  sendNotification(message: string): void {
    this.http.post<any>(`${this.apiUrl}/admin/notifications/send`, { message }, this.getAuthOptions()).subscribe({
      next: () => this.toast.showToast('Notification sent', 'success'),
      error: () => this.toast.showToast('Failed to send notification', 'error')
    });
  }

  // ---------- Support ----------
  resolveTicket(ticket: SupportTicket): void {
    this.http.post<any>(`${this.apiUrl}/admin/support/tickets/${ticket.id}/resolve`, {}, this.getAuthOptions()).subscribe({
      next: () => {
        ticket.status = 'resolved';
        this.toast.showToast('Ticket resolved', 'success');
        this.cdr.markForCheck();
      },
      error: () => this.toast.showToast('Failed to resolve ticket', 'error')
    });
  }

  // ---------- Utilities ----------
  switchTab(tab: string): void {
    this.activeTab = tab;
    this.cdr.markForCheck();
  }

  private mockDrivers(): Driver[] {
    return [
      { id: 'd1', nom_complet: 'Ahmed Ben Ali', email: 'ahmed@example.com', statut: 'pending', rating: 4.8, deliveries_completed: 150 },
      { id: 'd2', nom_complet: 'Marie Dupont', email: 'marie@example.com', statut: 'active', rating: 4.9, deliveries_completed: 320 }
    ];
  }

  private mockCustomers(): Customer[] {
    return [
      { id: 'c1', nom_complet: 'John Smith', email: 'john@example.com', status: 'active', orders_count: 12 },
      { id: 'c2', nom_complet: 'Sarah Johnson', email: 'sarah@example.com', status: 'active', orders_count: 28 }
    ];
  }

  private mockDeliveries(): Delivery[] {
    return [
      { id: 'del1', numero_suivi: 'DEL-001', driver_id: 'd1', status: 'ongoing', montant_total: 45.0 },
      { id: 'del2', numero_suivi: 'DEL-002', driver_id: 'd2', status: 'delivered', montant_total: 32.5 }
    ];
  }

  formatCurrency(v: number): string {
    return (v || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  }
}
