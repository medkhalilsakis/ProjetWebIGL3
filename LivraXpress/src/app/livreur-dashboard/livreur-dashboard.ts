import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { AuthService } from '../services/authentification';
import { ToastService } from '../services/toast';

interface Delivery {
  id: string;
  numero_suivi?: string;
  items?: string[];
  package_size?: string;
  pickup_address?: string;
  dropoff_address?: string;
  instructions?: string;
  eta_minutes?: number;
  remaining_km?: number;
  status: 'ongoing' | 'upcoming' | 'delivered' | 'cancelled' | string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

interface Earnings {
  today: number;
  week: number;
  month: number;
  tipsToday?: number;
}

interface Stats {
  completed: number;
  avgDeliveryTimeMinutes: number;
  cancellations: number;
  satisfaction?: number; // 0-100
}

interface AppNotification {
  id: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
}

@Component({
  selector: 'app-livreur-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './livreur-dashboard.html',
  styleUrls: ['./livreur-dashboard.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LivreurDashboard implements OnInit, OnDestroy {
  public apiUrl = 'http://localhost:3000/api';

  // Lists
  ongoing: Delivery[] = [];
  upcoming: Delivery[] = [];

  // Map / realtime
  driverLat = 0;
  driverLng = 0;
  optimizedRoute: any[] = [];
  hotspots: { lat: number; lng: number; intensity: number }[] = [];

  // Earnings / stats
  earnings: Earnings = { today: 0, week: 0, month: 0, tipsToday: 0 };
  stats: Stats = { completed: 0, avgDeliveryTimeMinutes: 0, cancellations: 0, satisfaction: 0 };

  // Notifications
  notifications: AppNotification[] = [];

  // Profile & status
  status: 'available' | 'busy' | 'offline' = 'available';
  driverProfile: any = null;

  // UI
  loading = true;
  selectedDelivery: Delivery | null = null;

  private updateSub: Subscription | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {
    const cur = this.authService.currentUserValue;
    this.driverProfile = cur ?? null;
  }

  // Helper to include auth headers (uses AuthService)
  private getAuthOptions() {
    return this.authService?.getAuthHeaders() || {};
  }

  ngOnInit(): void {
    this.loadAll();

    // periodic updates every 20s
    this.updateSub = interval(20000).subscribe(() => this.loadDelta());
  }

  ngOnDestroy(): void {
    if (this.updateSub) this.updateSub.unsubscribe();
  }

  // ---------- Loading ----------
  loadAll(): void {
    this.loading = true;
    this.loadOngoing();
    this.loadUpcoming();
    this.loadEarnings();
    this.loadStats();
    this.loadNotifications();
    // try to get driver location (if permitted by browser)
    this.watchDriverLocation();
    this.loading = false;
    this.cdr.markForCheck();
  }

  loadDelta(): void {
    this.loadOngoing();
    this.loadNotifications();
    this.loadEarnings();
    this.cdr.markForCheck();
  }

  private loadOngoing(): void {
    this.http.get<any>(`${this.apiUrl}/livreur/deliveries/ongoing`, this.getAuthOptions()).subscribe({
      next: res => {
        if (res?.success && Array.isArray(res.data)) {
          this.ongoing = res.data;
        } else {
          // fallback: keep current or empty
        }
        this.cdr.markForCheck();
      },
      error: () => {
        // silent: API may not exist yet, keep mock data
        if (this.ongoing.length === 0) this.ongoing = this.mockOngoing();
        this.cdr.markForCheck();
      }
    });
  }

  private loadUpcoming(): void {
    this.http.get<any>(`${this.apiUrl}/livreur/deliveries/upcoming`, this.getAuthOptions()).subscribe({
      next: res => {
        if (res?.success && Array.isArray(res.data)) {
          this.upcoming = res.data;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        if (this.upcoming.length === 0) this.upcoming = this.mockUpcoming();
        this.cdr.markForCheck();
      }
    });
  }

  private loadEarnings(): void {
    this.http.get<any>(`${this.apiUrl}/livreur/earnings`, this.getAuthOptions()).subscribe({
      next: res => {
        if (res?.success && res.data) this.earnings = res.data;
        this.cdr.markForCheck();
      },
      error: () => {
        // fallback sample
        this.earnings = { today: 78.5, week: 620.0, month: 2480.2, tipsToday: 12.5 };
        this.cdr.markForCheck();
      }
    });
  }

  private loadStats(): void {
    this.http.get<any>(`${this.apiUrl}/livreur/stats`, this.getAuthOptions()).subscribe({
      next: res => {
        if (res?.success && res.data) this.stats = res.data;
        this.cdr.markForCheck();
      },
      error: () => {
        this.stats = { completed: 124, avgDeliveryTimeMinutes: 23, cancellations: 4, satisfaction: 92 };
        this.cdr.markForCheck();
      }
    });
  }

  private loadNotifications(): void {
    this.http.get<any>(`${this.apiUrl}/livreur/notifications`, this.getAuthOptions()).subscribe({
      next: res => {
        if (res?.success && Array.isArray(res.data)) this.notifications = res.data;
        this.cdr.markForCheck();
      },
      error: () => {
        // sample
        this.notifications = [
          { id: '1', message: 'Nouvelle mission disponible à 2 km', severity: 'info', timestamp: new Date().toISOString() }
        ];
        this.cdr.markForCheck();
      }
    });
  }

  // ---------- Actions ----------
  acceptMission(d: Delivery): void {
    this.http.post<any>(`${this.apiUrl}/livreur/deliveries/${d.id}/accept`, {}, this.getAuthOptions()).subscribe({
      next: res => {
        if (res?.success) {
          this.toast.showToast('Mission acceptée', 'success');
          this.loadAll();
        }
      },
      error: () => {
        this.toast.showToast('Impossible d\'accepter la mission', 'error');
      }
    });
  }

  markDelivered(d: Delivery): void {
    this.http.post<any>(`${this.apiUrl}/livreur/deliveries/${d.id}/delivered`, {}, this.getAuthOptions()).subscribe({
      next: res => {
        if (res?.success) {
          this.toast.showToast('Livraison marquée comme livrée', 'success');
          this.loadAll();
        }
      },
      error: () => {
        this.toast.showToast('Impossible de marquer comme livrée', 'error');
      }
    });
  }

  navigateTo(address: string): void {
    // Open Google Maps directions in a new tab (quick integration)
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    window.open(url, '_blank');
  }

  toggleStatus(newStatus: 'available' | 'busy' | 'offline'): void {
    this.status = newStatus;
    this.toast.showToast(`Status: ${newStatus}`, 'info');
  }

  reportIncident(deliveryId: string, description: string): void {
    this.http.post<any>(`${this.apiUrl}/livreur/incidents`, { deliveryId, description }, this.getAuthOptions()).subscribe({
      next: res => this.toast.showToast('Incident signalé', 'success'),
      error: () => this.toast.showToast('Échec signalement incident', 'error')
    });
  }

  // ---------- Location ----------
  private watchDriverLocation(): void {
    if (!('geolocation' in navigator)) return;
    try {
      navigator.geolocation.getCurrentPosition(pos => {
        this.driverLat = pos.coords.latitude;
        this.driverLng = pos.coords.longitude;
        this.cdr.markForCheck();
      });
    } catch (e) {}
  }

  // ---------- Utilities / Mock data ----------
  private mockOngoing(): Delivery[] {
    return [
      {
        id: 'd_001',
        numero_suivi: 'LD-001',
        items: ['Box - Electronics'],
        package_size: 'Medium',
        pickup_address: '10 Rue de Paris, Lyon',
        dropoff_address: '45 Av. Victor Hugo, Lyon',
        instructions: 'Sonner à l\'interphone 3B',
        eta_minutes: 12,
        remaining_km: 3.4,
        status: 'ongoing',
        priority: 'high'
      }
    ];
  }

  private mockUpcoming(): Delivery[] {
    return [
      {
        id: 'd_002',
        numero_suivi: 'LD-002',
        items: ['Envelope - Documents'],
        package_size: 'Small',
        pickup_address: 'Station Part-Dieu, Lyon',
        dropoff_address: '2 Rue de la République, Lyon',
        instructions: '',
        eta_minutes: 45,
        remaining_km: 8.2,
        status: 'upcoming',
        priority: 'normal'
      }
    ];
  }

  formatCurrency(v: number): string {
    return (v || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  }
}
