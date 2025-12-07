// frontend/src/app/features/client/dashboard/dashboard.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/authentification';
import { ToastService } from '../services/toast';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { interval, Subscription } from 'rxjs';

interface DashboardStats {
  total_commandes: number;
  commandes_en_cours: number;
  commandes_livrees: number;
  montant_total_depense: number;
  montant_economise: number;
  temps_economise: number;
}

interface LoyaltyLevel {
  level: string;
  icon: string;
  nextLevel: string;
  progress: number;
}

interface Notification {
  id: string;
  message: string;
  type: 'order' | 'promotion' | 'delivery' | 'achievement';
  timestamp: Date;
}

interface Driver {
  id: string;
  nom: string;
  avatar: string;
  stats: {
    ordersDelivered: number;
    satisfaction: number;
    vehicle: string;
  };
  message?: string;
}

interface ActiveOrder {
  id: string;
  numero_suivi: string;
  status: 'preparation' | 'pickup' | 'en_route' | 'delivered';
  estimatedArrival: Date;
  driver: Driver;
  progress: number;
  latitude: number;
  longitude: number;
  trafficCondition: 'light' | 'moderate' | 'heavy';
}

@Component({
  selector: 'app-client-dashboard',
  templateUrl: './client-dashboard.html',
  styleUrls: ['./client-dashboard.css'],
  imports: [CommonModule]
})
export class ClientDashboardComponent implements OnInit, OnDestroy {
  loading = true;
  activeTab: 'home' | 'tracking' | 'history' | 'loyalty' | 'payments' = 'home';
  stats: DashboardStats = {
    total_commandes: 0,
    commandes_en_cours: 0,
    commandes_livrees: 0,
    montant_total_depense: 0,
    montant_economise: 0,
    temps_economise: 0
  };
  
  recentCommandes: any[] = [];
  fournisseursFavoris: any[] = [];
  currentUser: any;
  
  // Loyalty & Gamification
  loyaltyLevel: LoyaltyLevel = {
    level: 'Silver',
    icon: '⭐',
    nextLevel: 'Gold',
    progress: 65
  };
  badges = [
    { name: 'Early Bird', icon: '🌅', achieved: true },
    { name: 'Local Champion', icon: '🏆', achieved: true },
    { name: 'Eco Warrior', icon: '🌱', achieved: false }
  ];
  
  // Real-time tracking
  activeOrder: ActiveOrder | null = null;
  trackingStats = {
    distanceTraveled: 0,
    co2Saved: 0
  };
  
  // Smart Notifications
  notifications: Notification[] = [];
  
  // Smart Recommendations
  recommendations: any[] = [];
  
  // Personalization
  trackingStyle: 'minimalist' | 'gaming' | 'chill' = 'gaming';
  
  private updateSubscription?: Subscription;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private toastService: ToastService,
    private router: Router
  ) {
    this.currentUser = this.authService.currentUserValue;
  }

  // Helper to include auth headers (fallback if interceptor is changed)
  private getAuthOptions() {
    return this.authService?.getAuthHeaders() || {};
  }

  ngOnInit(): void {
    this.loadDashboardData();
    this.initializeRealtimeTracking();
    this.loadSmartRecommendations();
  }

  ngOnDestroy(): void {
    if (this.updateSubscription) {
      this.updateSubscription.unsubscribe();
    }
  }

  loadDashboardData(): void {
    this.loading = true;

    // Charger les commandes récentes (endpoint existant)
    this.http.get<any>(`http://localhost:3000/api/commandes?limit=5`, this.getAuthOptions())
      .subscribe({
        next: (response) => {
          if (response.success && response.commandes) {
            this.recentCommandes = response.commandes;
            // Calculate stats from commandes
            this.stats.total_commandes = response.commandes.length;
            this.stats.commandes_livrees = response.commandes.filter((c: any) => c.statut === 'livree').length;
            this.stats.commandes_en_cours = response.commandes.filter((c: any) => c.statut !== 'livree' && c.statut !== 'annulee').length;
            this.stats.montant_total_depense = response.commandes.reduce((sum: number, c: any) => sum + (c.montant_total || 0), 0);
            this.stats.montant_economise = Math.floor(this.stats.montant_total_depense * 0.15); // 15% assumed savings
            this.stats.temps_economise = this.stats.total_commandes; // 1 hour per order assumed
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Erreur chargement commandes:', error);
          this.loading = false;
          // Set default stats on error
          this.stats = {
            total_commandes: 0,
            commandes_en_cours: 0,
            commandes_livrees: 0,
            montant_total_depense: 0,
            montant_economise: 0,
            temps_economise: 0
          };
        }
      });

    // Mock favorites data since endpoint may not exist
    this.fournisseursFavoris = [
      {
        nom_entreprise: 'Pizza Palace',
        photo_couverture: 'https://via.placeholder.com/300',
        note_moyenne: 4.8,
        nombre_avis: 245,
        temps_preparation_moyen: 20,
        frais_livraison: 2.99
      },
      {
        nom_entreprise: 'Burger King',
        photo_couverture: 'https://via.placeholder.com/300',
        note_moyenne: 4.5,
        nombre_avis: 189,
        temps_preparation_moyen: 15,
        frais_livraison: 1.99
      }
    ];
  }

  getStatusBadgeClass(statut: string): string {
    const classes: { [key: string]: string } = {
      en_attente: 'badge-warning',
      en_preparation: 'badge-info',
      pret_pour_livraison: 'badge-info',
      en_livraison: 'badge-info',
      livree: 'badge-success',
      annulee: 'badge-danger',
      probleme: 'badge-danger'
    };
    return `badge ${classes[statut] || 'badge-info'}`;
  }

  getStatusLabel(statut: string): string {
    const labels: { [key: string]: string } = {
      en_attente: 'En attente',
      en_preparation: 'En préparation',
      pret_pour_livraison: 'Prêt pour livraison',
      en_livraison: 'En livraison',
      livree: 'Livrée',
      annulee: 'Annulée',
      probleme: 'Problème'
    };
    return labels[statut] || statut;
  }

  trackCommande(commandeId: string): void {
    this.activeTab = 'tracking';
  }

  // ========== REAL-TIME TRACKING ==========
  initializeRealtimeTracking(): void {
    // Simulate real-time updates every 5 seconds
    this.updateSubscription = interval(5000).subscribe(() => {
      this.updateOrderTracking();
    });
  }

  updateOrderTracking(): void {
    if (this.activeOrder) {
      // Simulate driver movement
      this.activeOrder.latitude += (Math.random() - 0.5) * 0.001;
      this.activeOrder.longitude += (Math.random() - 0.5) * 0.001;
      
      // Update estimated arrival
      const now = new Date().getTime();
      const arrival = new Date(this.activeOrder.estimatedArrival).getTime();
      this.activeOrder.progress = Math.min(100, ((now / arrival) * 100));
      
      // Simulate traffic updates
      const trafficRandom = Math.random();
      this.activeOrder.trafficCondition = trafficRandom < 0.4 ? 'light' : trafficRandom < 0.8 ? 'moderate' : 'heavy';
    }
  }

  getTrafficEmoji(condition: string): string {
    const emojis: { [key: string]: string } = {
      light: '🟢',
      moderate: '🟡',
      heavy: '🔴'
    };
    return emojis[condition] || '🟢';
  }

  // ========== SMART RECOMMENDATIONS ==========
  loadSmartRecommendations(): void {
    // Get current time and weather for smart recommendations
    const hour = new Date().getHours();
    const season = this.getCurrentSeason();
    
    this.recommendations = this.getTimeBasedRecommendations(hour)
      .concat(this.getSeasonalRecommendations(season))
      .concat(this.getHistoryBasedRecommendations());
  }

  getTimeBasedRecommendations(hour: number): any[] {
    if (hour >= 11 && hour < 14) {
      return [{ type: 'meal', emoji: '🍕', text: 'Déjeuner rapide ?' }];
    } else if (hour >= 18 && hour < 21) {
      return [{ type: 'dinner', emoji: '🍽️', text: 'Dîner gourmand ?' }];
    } else if (hour >= 15 && hour < 17) {
      return [{ type: 'snack', emoji: '☕', text: 'Pause goûter ?' }];
    }
    return [];
  }

  getSeasonalRecommendations(season: string): any[] {
    const recommendations: { [key: string]: any } = {
      summer: { emoji: '🍦', text: 'Glaces et boissons fraîches' },
      winter: { emoji: '☕', text: 'Boissons chaudes et desserts' },
      spring: { emoji: '🥗', text: 'Salades et plats légers' },
      fall: { emoji: '🎃', text: 'Plats réconfortants' }
    };
    return [recommendations[season] || {}];
  }

  getHistoryBasedRecommendations(): any[] {
    // Mock data - would come from API
    return [
      { emoji: '🍣', text: 'Vous adorez les sushi le vendredi !' },
      { emoji: '🍔', text: 'Burgers tendance cette semaine' }
    ];
  }

  getCurrentSeason(): string {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  // ========== LOYALTY & GAMIFICATION ==========
  unlockBadge(badgeName: string): void {
    const badge = this.badges.find(b => b.name === badgeName);
    if (badge) {
      badge.achieved = true;
    }
  }

  spinRewardsWheel(): void {
    const rewards = ['50 DH credit', '10% off', 'Free delivery', '100 points'];
    const randomReward = rewards[Math.floor(Math.random() * rewards.length)];
    alert(`🎉 Congratulations! You won: ${randomReward}`);
  }

  // ========== PAYMENT MANAGEMENT ==========
  getMonthlySpending(): number {
    return this.stats.montant_total_depense;
  }

  toggleSplitPayment(): void {
    console.log('Split payment enabled');
  }

  // ========== DRIVER COMMUNICATION ==========
  sendQuickMessage(message: string): void {
    console.log('Sending message to driver:', message);
  }

  shareLocationWithDriver(): void {
    console.log('Location shared with driver');
  }

  // ========== ENVIRONMENTAL IMPACT ==========
  calculateCO2Saved(): number {
    return this.trackingStats.co2Saved;
  }

  offsetCO2Emissions(): void {
    console.log('CO2 offset initiated');
  }

  // ========== TAB NAVIGATION ==========
  switchTab(tab: 'home' | 'tracking' | 'history' | 'loyalty' | 'payments'): void {
    this.activeTab = tab;
  }

  // ========== LOGOUT ==========
  logout(): void {
    if (!confirm('Are you sure you want to disconnect?')) return;
    this.authService.logout();
    this.toastService.showToast('Disconnected successfully', 'success');
    this.router.navigate(['/'], { replaceUrl: true });
  }
}