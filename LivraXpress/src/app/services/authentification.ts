import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

export interface User {
  id: string;
  email: string;
  nom_complet: string;
  telephone: string;
  role: 'client' | 'fournisseur' | 'livreur' | 'admin';
  statut?: string;
  photo_profil?: string;
  role_id?: string | null;
  session_token?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `http://localhost:3000/api/auth`;
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    const storedUser = sessionStorage.getItem('currentUser');
    this.currentUserSubject = new BehaviorSubject<User | null>(
      storedUser ? JSON.parse(storedUser) : null
    );
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public get isAuthenticated(): boolean {
    return !!this.currentUserValue;
  }

  public get userRole(): string | null {
    return this.currentUserValue?.role ?? null;
  }

  public getAuthHeaders(): { headers?: HttpHeaders } {
    const token = sessionStorage.getItem('session_token');
    if (token) {
      return { headers: new HttpHeaders({ 'Authorization': `Bearer ${token}` }) };
    }
    return {};
  }

  login(email: string, mot_de_passe: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, { email, mot_de_passe })
      .pipe(map(response => {
        if (response?.success && response.user) {
          // Stocker l'utilisateur et le token
          sessionStorage.setItem('currentUser', JSON.stringify(response.user));
          if (response.user.session_token) {
            sessionStorage.setItem('session_token', response.user.session_token);
          }
          this.currentUserSubject.next(response.user);
        }
        return response;
      }));
  }

  // Extend the current session expiration on the server
  extendSession(): Observable<any> {
    const token = sessionStorage.getItem('session_token');
    if (!token) return of({ success: false, message: 'No session token' });

    // sessions endpoint lives under /api/sessions
    return this.http.post<any>(`http://localhost:3000/api/sessions/extend`, { session_token: token })
      .pipe(map(response => {
        if (response?.success && response.session) {
          // Optionally update token/expiry if server returned updated session/user
          if (response.session.token_session) {
            sessionStorage.setItem('session_token', response.session.token_session);
          }
        }
        return response;
      }));
  }

  register(userData: any): Observable<any> {
    // register via /api/auth/register
    return this.http.post<any>(`${this.apiUrl}/register`, userData);
  }

  logout(): void {
    const token = sessionStorage.getItem('session_token');
    if (token) {
      // appel asynchrone pour informer le serveur (on ne bloque pas)
      this.http.post(`${this.apiUrl}/logout`, { session_token: token }).subscribe({
        next: () => {},
        error: () => {}
      });
    }

    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('session_token');
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  verifySession(): Observable<any> {
    const token = sessionStorage.getItem('session_token');
    if (!token) return of({ success: false });

    return this.http.post<any>(`${this.apiUrl}/verify-session`, { session_token: token })
      .pipe(map(response => {
        if (response?.success && response.user) {
          // Met à jour l'utilisateur stocké avec les données renvoyées par le serveur
          sessionStorage.setItem('currentUser', JSON.stringify(response.user));
          if (response.user.session_token) sessionStorage.setItem('session_token', response.user.session_token);
          this.currentUserSubject.next(response.user);
        } else {
          this.logout();
        }
        return response;
      }));
  }

  // Validate an arbitrary token (useful for deep-links or external checks)
  validateToken(token: string): Observable<any> {
    if (!token) return of({ success: false });
    return this.http.post<any>(`http://localhost:3000/api/sessions/validate`, { session_token: token });
  }

  // Exemple d'upload d'image : assure-toi d'avoir un endpoint backend qui accepte ça
  uploadProfileImage(file: File): Observable<any> {
    const current = this.currentUserValue;
    if (!current) return of({ success: false, message: 'Non authentifié' });

    const fd = new FormData();
    fd.append('image', file);

    // Exemple : POST /api/utilisateurs/:id/photo
    const url = `http://localhost:3000/api/utilisateurs/${current.id}/photo`;
    return this.http.post<any>(url, fd, this.getAuthHeaders()).pipe(map(response => {
      if (response?.success && response.photo_url) {
        const updated = { ...current, photo_profil: response.photo_url };
        sessionStorage.setItem('currentUser', JSON.stringify(updated));
        this.currentUserSubject.next(updated);
      }
      return response;
    }));
  }

  // Update profile : utilise /api/utilisateurs/:id (PUT)
  updateProfile(data: any): Observable<any> {
    const current = this.currentUserValue;
    if (!current) return of({ success: false, message: 'Non authentifié' });

    const url = `http://localhost:3000/api/utilisateurs/${current.id}`;
    return this.http.put<any>(url, data, this.getAuthHeaders())
      .pipe(map(response => {
        if (response?.utilisateur) {
          const updated = { ...current, ...response.utilisateur };
          sessionStorage.setItem('currentUser', JSON.stringify(updated));
          this.currentUserSubject.next(updated);
        }
        return response;
      }));
  }
}
