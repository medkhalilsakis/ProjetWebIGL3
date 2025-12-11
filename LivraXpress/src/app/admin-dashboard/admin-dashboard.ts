import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { AuthService } from '../services/authentification';
import { ToastService } from '../services/toast';
import { LivreurVerificationService } from '../services/livreur-verification';
import { interval, Subscription } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';

// Interfaces
interface DashboardStats {
  totalLivreurs: number;
  livreursEnAttente: number;
  livreursActifs: number;
  livreursSuspendus: number;
  commandesEnCours: number;
  revenusTotaux: number;
  totalFournisseurs: number;
  totalClients: number;
  statsJour: PerformanceStats;
  statsSemaine: PerformanceStats;
  statsMois: PerformanceStats;
}

interface PerformanceStats {
  commandes: number;
  revenus: number;
  livreursActifs: number;
  tauxLivraison: number;
}

interface Livreur {
  id: string;
  nom_complet: string;
  email: string;
  photo_profil?: string;
  telephone?: string;
  statut: string;
  type_vehicule?: string;
  numero_permis?: string;
  note_moyenne?: number;
  nombre_livraisons?: number;
  date_creation: string;
  verifie?: boolean;
}

interface Fournisseur {
  id: string;
  nom_complet: string;
  email: string;
  nom_entreprise: string;
  type_fournisseur: string;
  statut: string;
  date_creation: string;
}

interface Client {
  id: string;
  nom_complet: string;
  email: string;
  telephone?: string;
  statut: string;
  date_creation: string;
}

interface Commande {
  id: string;
  numero_suivi: string;
  montant_total: number;
  statut: string;
  fournisseur?: string;
  client_nom?: string;
  date_commande: string;
  livreur_id?: string;
}

interface Paiement {
  id: string;
  commande_id: string;
  montant: number;
  mode_paiement: string;
  statut: string;
  date_creation: string;
}

interface SupportTicket {
  id: string;
  utilisateur_id: string;
  sujet: string;
  message: string;
  statut: string;
  priorite: string;
  date_creation: string;
}

interface Notification {
  id: string;
  titre: string;
  message: string;
  type: string;
  lu: boolean;
  date_creation: string;
}

interface Document {
  id: string;
  type_document: string;
  chemin_fichier: string;
  date_upload: string;
}

interface LivreurDetails extends Livreur {
  livreur_id?: string;
  documents?: Document[];
  vehicule_enregistre?: boolean;
  assurance_valide?: boolean;
}

@Component({
  selector: 'app-admin-dashboard',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, MatIconModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  apiUrl = 'http://localhost:3000/api/admin';
  
  // Vue d'ensemble
  stats: DashboardStats = {
    totalLivreurs: 0,
    livreursEnAttente: 0,
    livreursActifs: 0,
    livreursSuspendus: 0,
    commandesEnCours: 0,
    revenusTotaux: 0,
    totalFournisseurs: 0,
    totalClients: 0,
    statsJour: { commandes: 0, revenus: 0, livreursActifs: 0, tauxLivraison: 0 },
    statsSemaine: { commandes: 0, revenus: 0, livreursActifs: 0, tauxLivraison: 0 },
    statsMois: { commandes: 0, revenus: 0, livreursActifs: 0, tauxLivraison: 0 }
  };

  // Onglets actifs
  activeTab: string = 'overview';
  statsPeriod: 'jour' | 'semaine' | 'mois' = 'jour';

  // Gestion des livreurs
  livreurs: Livreur[] = [];
  livreursEnAttenteList: LivreurDetails[] = [];
  livreursFilter: 'all' | 'pending' | 'active' | 'suspended' = 'all';
  selectedLivreur: Livreur | null = null;
  selectedLivreurEnAttente: LivreurDetails | null = null;
  showLivreurModal = false;
  showLivreurDetailsModal = false;
  raisonRejet = '';
  acceptRejectLoading = false;

  // Gestion des fournisseurs
  fournisseurs: Fournisseur[] = [];
  fournisseursFilter: 'all' | 'active' | 'suspended' = 'all';
  selectedFournisseur: Fournisseur | null = null;
  showFournisseurModal = false;

  // Gestion des clients
  clients: Client[] = [];
  clientsFilter: 'all' | 'active' | 'suspended' = 'all';
  selectedClient: Client | null = null;
  showClientModal = false;

  // Gestion des commandes
  commandes: Commande[] = [];
  commandesFilter: 'all' | 'en_cours' | 'livree' | 'annulee' = 'all';
  selectedCommande: Commande | null = null;
  showCommandeModal = false;

  // Gestion des paiements
  paiements: Paiement[] = [];
  paiementsFilter: 'all' | 'paye' | 'en_attente' | 'refuse' = 'all';
  revenusTotal = 0;
  revenusMois = 0;
  revenusSemaine = 0;
  revenusJour = 0;

  // Centre de support
  tickets: SupportTicket[] = [];
  ticketsFilter: 'all' | 'ouvert' | 'en_cours' | 'resolu' = 'all';
  selectedTicket: SupportTicket | null = null;
  showTicketModal = false;

  // Notifications
  notifications: Notification[] = [];
  unreadCount = 0;

  // Rapports
  reportType: 'commandes' | 'revenus' | 'utilisateurs' | 'livreurs' = 'commandes';
  reportPeriod: 'jour' | 'semaine' | 'mois' | 'annee' = 'mois';

  // États de chargement
  loading = false;
  refreshInterval?: Subscription;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private toast: ToastService,
    private router: Router,
    private livreurVerificationService: LivreurVerificationService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
    // Rafraîchir les données toutes les 30 secondes
    this.refreshInterval = interval(30000).subscribe(() => {
      this.loadDashboardData();
    });
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      this.refreshInterval.unsubscribe();
    }
  }

  loadDashboardData(): void {
    this.loadStats();
    this.loadLivreurs();
    this.loadLivreursEnAttente();
    this.loadFournisseurs();
    this.loadClients();
    this.loadCommandes();
    this.loadPaiements();
    this.loadTickets();
    this.loadNotifications();
  }

  // ========== STATISTIQUES ==========
  loadStats(): void {
    this.loading = true;
    const authOptions = this.auth.getAuthHeaders();
    
    this.http.get<{ success: boolean; data: any }>(`${this.apiUrl}/statistiques`, authOptions)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.stats.totalLivreurs = response.data.totalDeliverers || 0;
            this.stats.commandesEnCours = response.data.ordersToday || 0;
            this.stats.revenusTotaux = response.data.revenueToday || 0;
            this.stats.totalFournisseurs = response.data.totalSuppliers || 0;
            // Charger les stats détaillées
            this.loadDetailedStats();
          }
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading stats:', err);
          this.loading = false;
        }
      });
  }

  loadDetailedStats(): void {
    const authOptions = this.auth.getAuthHeaders();
    // Charger les stats détaillées pour livreurs
    this.http.get<{ success: boolean; data: Livreur[] }>(
      `${this.apiUrl}/utilisateurs?role=livreur`,
      authOptions
    ).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.stats.livreursEnAttente = response.data.filter(l => l.statut === 'verifie').length;
          this.stats.livreursActifs = response.data.filter(l => l.statut === 'actif').length;
          this.stats.livreursSuspendus = response.data.filter(l => l.statut === 'suspendu').length;
        }
      }
    });

    // Charger les stats pour clients
    this.http.get<{ success: boolean; data: Client[] }>(
      `${this.apiUrl}/utilisateurs?role=client`,
      authOptions
    ).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.stats.totalClients = response.data.length;
        }
      }
    });
  }

  // ========== GESTION DES LIVREURS ==========
  loadLivreurs(): void {
    const authOptions = this.auth.getAuthHeaders();
    let params = new HttpParams().set('role', 'livreur');
    
    this.http.get<{ success: boolean; data: Livreur[] }>(
      `${this.apiUrl}/utilisateurs`,
      { ...authOptions, params }
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.livreurs = response.data || [];
        }
      },
      error: (err) => console.error('Error loading livreurs:', err)
    });
  }

  get filteredLivreurs(): Livreur[] {
    if (this.livreursFilter === 'all') return this.livreurs;
    return this.livreurs.filter(l => {
      if (this.livreursFilter === 'pending') return l.statut === 'verifie';
      if (this.livreursFilter === 'active') return l.statut === 'actif';
      if (this.livreursFilter === 'suspended') return l.statut === 'suspendu';
      return true;
    });
  }

  viewLivreur(livreur: Livreur): void {
    this.selectedLivreur = livreur;
    this.showLivreurModal = true;
  }

  updateLivreurStatus(livreurId: string, newStatus: string): void {
    const authOptions = this.auth.getAuthHeaders();
    this.http.patch<{ success: boolean }>(
      `${this.apiUrl}/utilisateurs/${livreurId}/statut`,
      { statut: newStatus },
      authOptions
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.toast.showToast('Statut du livreur mis à jour', 'success');
          this.loadLivreurs();
          this.loadStats();
          this.showLivreurModal = false;
        }
      },
      error: (err) => {
        this.toast.showToast('Erreur lors de la mise à jour', 'error');
      }
    });
  }

  verifyLivreur(livreurId: string): void {
    this.updateLivreurStatus(livreurId, 'actif');
  }

  suspendLivreur(livreurId: string): void {
    this.updateLivreurStatus(livreurId, 'suspendu');
  }

  // ========== GESTION DES LIVREURS EN ATTENTE ==========
  loadLivreursEnAttente(): void {
  this.livreurVerificationService.getPendingLivreurs().subscribe({
    next: (response) => {
      if (response.success) {
        // Map pour garantir que chaque objet a bien un statut (string)
        this.livreursEnAttenteList = (response.data || []).map(l => ({
          // si votre interface LivreurDetails possède d'autres champs,
          // on les propage (spread) puis on force statut à une string
          ...l,
          statut: l.statut ?? 'verifie',
          documents: l.documents ?? []
        })) as LivreurDetails[];

        this.stats.livreursEnAttente = this.livreursEnAttenteList.length;
      }
    },
    error: (err) => {
      console.error('Error loading pending livreurs:', err);
      this.toast.showToast('Erreur lors du chargement des livreurs en attente', 'error');
    }
  });
}


  viewLivreurDetails(livreur: LivreurDetails): void {
    this.selectedLivreurEnAttente = livreur;
    this.showLivreurDetailsModal = true;
    this.raisonRejet = '';
  }

  closeLivreurDetailsModal(): void {
    this.showLivreurDetailsModal = false;
    this.selectedLivreurEnAttente = null;
    this.raisonRejet = '';
  }

  accepterLivreur(livreurId: string): void {
    if (!confirm('Êtes-vous sûr de vouloir accepter ce livreur ?')) return;

    this.acceptRejectLoading = true;
    this.livreurVerificationService.accepterLivreur(livreurId).subscribe({
      next: (response) => {
        if (response.success) {
          this.toast.showToast('Livreur accepté et compte activé', 'success');
          this.loadLivreursEnAttente();
          this.loadStats();
          this.closeLivreurDetailsModal();
        }
        this.acceptRejectLoading = false;
      },
      error: (err) => {
        console.error('Error accepting livreur:', err);
        this.toast.showToast('Erreur lors de l\'acceptation du livreur', 'error');
        this.acceptRejectLoading = false;
      }
    });
  }

  rejeterLivreur(livreurId: string): void {
    if (!this.raisonRejet.trim()) {
      this.toast.showToast('Veuillez fournir une raison pour le rejet', 'error');
      return;
    }

    if (!confirm('Êtes-vous sûr de vouloir rejeter ce livreur ?')) return;

    this.acceptRejectLoading = true;
    this.livreurVerificationService.rejeterLivreur(livreurId, this.raisonRejet).subscribe({
      next: (response) => {
        if (response.success) {
          this.toast.showToast('Livreur rejeté', 'success');
          this.loadLivreursEnAttente();
          this.loadStats();
          this.closeLivreurDetailsModal();
        }
        this.acceptRejectLoading = false;
      },
      error: (err) => {
        console.error('Error rejecting livreur:', err);
        this.toast.showToast('Erreur lors du rejet du livreur', 'error');
        this.acceptRejectLoading = false;
      }
    });
  }

  getDocumentUrl(cheminFichier: string): string {
    return this.livreurVerificationService.getDocumentUrl(cheminFichier);
  }

  // ========== GESTION DES FOURNISSEURS ==========
  loadFournisseurs(): void {
    const authOptions = this.auth.getAuthHeaders();
    let params = new HttpParams().set('role', 'fournisseur');
    
    this.http.get<{ success: boolean; data: Fournisseur[] }>(
      `${this.apiUrl}/utilisateurs`,
      { ...authOptions, params }
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.fournisseurs = response.data || [];
        }
      },
      error: (err) => console.error('Error loading fournisseurs:', err)
    });
  }

  get filteredFournisseurs(): Fournisseur[] {
    if (this.fournisseursFilter === 'all') return this.fournisseurs;
    return this.fournisseurs.filter(f => {
      if (this.fournisseursFilter === 'active') return f.statut === 'actif';
      if (this.fournisseursFilter === 'suspended') return f.statut === 'suspendu';
      return true;
    });
  }

  updateFournisseurStatus(fournisseurId: string, newStatus: string): void {
    const authOptions = this.auth.getAuthHeaders();
    this.http.patch<{ success: boolean }>(
      `${this.apiUrl}/utilisateurs/${fournisseurId}/statut`,
      { statut: newStatus },
      authOptions
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.toast.showToast('Statut du fournisseur mis à jour', 'success');
          this.loadFournisseurs();
          this.loadStats();
        }
      },
      error: (err) => {
        this.toast.showToast('Erreur lors de la mise à jour', 'error');
      }
    });
  }

  // ========== GESTION DES CLIENTS ==========
  loadClients(): void {
    const authOptions = this.auth.getAuthHeaders();
    let params = new HttpParams().set('role', 'client');
    
    this.http.get<{ success: boolean; data: Client[] }>(
      `${this.apiUrl}/utilisateurs`,
      { ...authOptions, params }
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.clients = response.data || [];
        }
      },
      error: (err) => console.error('Error loading clients:', err)
    });
  }

  get filteredClients(): Client[] {
    if (this.clientsFilter === 'all') return this.clients;
    return this.clients.filter(c => {
      if (this.clientsFilter === 'active') return c.statut === 'actif';
      if (this.clientsFilter === 'suspended') return c.statut === 'suspendu';
      return true;
    });
  }

  updateClientStatus(clientId: string, newStatus: string): void {
    const authOptions = this.auth.getAuthHeaders();
    this.http.patch<{ success: boolean }>(
      `${this.apiUrl}/utilisateurs/${clientId}/statut`,
      { statut: newStatus },
      authOptions
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.toast.showToast('Statut du client mis à jour', 'success');
          this.loadClients();
          this.loadStats();
        }
      },
      error: (err) => {
        this.toast.showToast('Erreur lors de la mise à jour', 'error');
      }
    });
  }

  // ========== GESTION DES COMMANDES ==========
  loadCommandes(): void {
    const authOptions = this.auth.getAuthHeaders();
    let params = new HttpParams();
    if (this.commandesFilter !== 'all') {
      params = params.set('statut', this.commandesFilter);
    }
    
    this.http.get<{ success: boolean; data: Commande[] }>(
      `${this.apiUrl}/commandes`,
      { ...authOptions, params }
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.commandes = response.data || [];
        }
      },
      error: (err) => console.error('Error loading commandes:', err)
    });
  }

  get filteredCommandes(): Commande[] {
    if (this.commandesFilter === 'all') return this.commandes;
    return this.commandes.filter(c => {
      if (this.commandesFilter === 'en_cours') return ['en_preparation', 'en_livraison'].includes(c.statut);
      return c.statut === this.commandesFilter;
    });
  }

  viewCommande(commande: Commande): void {
    const authOptions = this.auth.getAuthHeaders();
    this.http.get<{ success: boolean; data: Commande }>(
      `${this.apiUrl}/commandes/${commande.id}`,
      authOptions
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.selectedCommande = response.data;
          this.showCommandeModal = true;
        }
      }
    });
  }

  // ========== GESTION DES PAIEMENTS ==========
  loadPaiements(): void {
    // Cette fonction devrait charger les paiements depuis l'API
    // Pour l'instant, on calcule depuis les commandes
    this.revenusTotal = this.commandes
      .filter(c => c.statut === 'livree')
      .reduce((sum, c) => sum + (c.montant_total || 0), 0);
    
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    this.revenusJour = this.commandes
      .filter(c => {
        const date = new Date(c.date_commande);
        return date.toDateString() === today.toDateString() && c.statut === 'livree';
      })
      .reduce((sum, c) => sum + (c.montant_total || 0), 0);

    this.revenusSemaine = this.commandes
      .filter(c => {
        const date = new Date(c.date_commande);
        return date >= weekAgo && c.statut === 'livree';
      })
      .reduce((sum, c) => sum + (c.montant_total || 0), 0);

    this.revenusMois = this.commandes
      .filter(c => {
        const date = new Date(c.date_commande);
        return date >= monthAgo && c.statut === 'livree';
      })
      .reduce((sum, c) => sum + (c.montant_total || 0), 0);
  }

  // ========== CENTRE DE SUPPORT ==========
  loadTickets(): void {
    // Cette fonction devrait charger les tickets depuis l'API
    // Pour l'instant, on utilise des données mockées
    this.tickets = [];
  }

  get filteredTickets(): SupportTicket[] {
    if (this.ticketsFilter === 'all') return this.tickets;
    return this.tickets.filter(t => {
      if (this.ticketsFilter === 'ouvert') return t.statut === 'ouvert';
      if (this.ticketsFilter === 'en_cours') return t.statut === 'en_cours';
      if (this.ticketsFilter === 'resolu') return t.statut === 'resolu';
      return true;
    });
  }

  // ========== NOTIFICATIONS ==========
  loadNotifications(): void {
    // Cette fonction devrait charger les notifications depuis l'API
    this.notifications = [];
    this.unreadCount = this.notifications.filter(n => !n.lu).length;
  }

  markNotificationAsRead(notificationId: string): void {
    // Marquer la notification comme lue
    const notif = this.notifications.find(n => n.id === notificationId);
    if (notif) {
      notif.lu = true;
      this.unreadCount = this.notifications.filter(n => !n.lu).length;
    }
  }

  // ========== UTILITAIRES ==========
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amount);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStatusBadge(status: string): string {
    const badges: { [key: string]: string } = {
      'actif': 'badge-success',
      'en_attente': 'badge-warning',
      'suspendu': 'badge-danger',
      'livree': 'badge-success',
      'en_preparation': 'badge-info',
      'en_livraison': 'badge-warning',
      'annulee': 'badge-danger'
    };
    return badges[status] || 'badge-secondary';
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'actif': 'Actif',
      'en_attente': 'En attente',
      'suspendu': 'Suspendu',
      'livree': 'Livrée',
      'en_preparation': 'En préparation',
      'en_livraison': 'En livraison',
      'annulee': 'Annulée'
    };
    return labels[status] || status;
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
    // Charger les données spécifiques à l'onglet
    if (tab === 'livreurs') this.loadLivreurs();
    if (tab === 'fournisseurs') this.loadFournisseurs();
    if (tab === 'clients') this.loadClients();
    if (tab === 'commandes') this.loadCommandes();
    if (tab === 'paiements') this.loadPaiements();
    if (tab === 'support') this.loadTickets();
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}

