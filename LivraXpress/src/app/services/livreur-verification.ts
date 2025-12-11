import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { AuthService } from './authentification';

interface Document {
  id: string;
  type_document: string;
  chemin_fichier: string;
  date_upload: string;
}

interface LivreurEnAttente {
  id: string;
  livreur_id?: string;
  email: string;
  nom_complet: string;
  statut?: string;
  telephone?: string;
  type_vehicule?: string;
  numero_permis?: string;
  date_creation: string;
  photo_profil?: string;
  documents: Document[];
}

interface PendingLivreursResponse {
  success: boolean;
  data: LivreurEnAttente[];
  total: number;
}

interface LivreurDetailsResponse {
  success: boolean;
  data: LivreurEnAttente;
}

interface VerificationResponse {
  success: boolean;
  message: string;
  data?: {
    livreurId: string;
    newStatus: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class LivreurVerificationService {
  private apiUrl = 'http://localhost:3000/api/admin';
  private pendingLivreursSubject = new BehaviorSubject<LivreurEnAttente[]>([]);
  public pendingLivreurs$ = this.pendingLivreursSubject.asObservable();

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {}

  /**
   * Récupère la liste des livreurs en attente de vérification
   */
  getPendingLivreurs(limit: number = 50, offset: number = 0): Observable<PendingLivreursResponse> {
    const params = new HttpParams()
      .set('limit', limit.toString())
      .set('offset', offset.toString());
    const authOptions = this.auth.getAuthHeaders();

    return this.http.get<PendingLivreursResponse>(
      `${this.apiUrl}/livreurs/en-attente`,
      { ...authOptions, params }
    );
  }

  /**
   * Récupère les détails complets d'un livreur en attente
   */
  getLivreurDetails(livreurId: string): Observable<LivreurDetailsResponse> {
    const authOptions = this.auth.getAuthHeaders();
    return this.http.get<LivreurDetailsResponse>(
      `${this.apiUrl}/livreurs/${livreurId}/details`,
      authOptions
    );
  }

  /**
   * Accepte un livreur après vérification
   */
  accepterLivreur(livreurId: string): Observable<VerificationResponse> {
    const authOptions = this.auth.getAuthHeaders();
    return this.http.put<VerificationResponse>(
      `${this.apiUrl}/livreurs/${livreurId}/verifier`,
      { action: 'accepter' },
      authOptions
    );
  }

  /**
   * Rejette un livreur avec raison optionnelle
   */
  rejeterLivreur(livreurId: string, raisonRejet?: string): Observable<VerificationResponse> {
    const authOptions = this.auth.getAuthHeaders();
    return this.http.put<VerificationResponse>(
      `${this.apiUrl}/livreurs/${livreurId}/verifier`,
      { 
        action: 'rejeter',
        raison_rejet: raisonRejet || null
      },
      authOptions
    );
  }

  /**
   * Met à jour la liste locale des livreurs en attente
   */
  updatePendingLivreurs(livreurs: LivreurEnAttente[]): void {
    this.pendingLivreursSubject.next(livreurs);
  }

  /**
   * Supprime un livreur de la liste locale après une action
   */
  removeLivreurFromPending(livreurId: string): void {
    const current = this.pendingLivreursSubject.value;
    const updated = current.filter(l => l.id !== livreurId);
    this.pendingLivreursSubject.next(updated);
  }

  /**
   * Récupère l'URL complète d'un document pour affichage
   */
  getDocumentUrl(cheminFichier: string): string {
    return `http://localhost:3000${cheminFichier}`;
  }
}
