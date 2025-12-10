// src/app/services/authentification.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

export interface User {
  id: string;
  email: string;
  nom_complet: string;
  telephone?: string;
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
    // Load from localStorage if present (remember me), else sessionStorage
    const stored = localStorage.getItem('currentUser') ?? sessionStorage.getItem('currentUser');
    this.currentUserSubject = new BehaviorSubject<User | null>(stored ? JSON.parse(stored) : null);
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public get currentToken(): string | null {
    // check several keys and storages
    return (
      localStorage.getItem('session_token') ||
      sessionStorage.getItem('session_token') ||
      localStorage.getItem('token') ||
      sessionStorage.getItem('token') ||
      null
    );
  }

  public get isAuthenticated(): boolean {
    return !!this.currentUserValue;
  }

  public get userRole(): string | null {
    return this.currentUserValue?.role ?? null;
  }

  public getAuthHeaders(): { headers?: HttpHeaders } {
    const token = this.currentToken;
    if (token) {
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'x-session-token': token
      });
      return { headers };
    }
    return {};
  }

  // Store current user centrally.
  // persist: if true -> localStorage (remember me), else sessionStorage.
  public setCurrentUser(user: User | null, persist = false) {
    if (user) {
      const serialized = JSON.stringify(user);
      if (persist) {
        localStorage.setItem('currentUser', serialized);
      } else {
        sessionStorage.setItem('currentUser', serialized);
      }
      this.currentUserSubject.next(user);
    } else {
      // logout
      sessionStorage.removeItem('currentUser');
      sessionStorage.removeItem('session_token');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('session_token');
      this.currentUserSubject.next(null);
    }
  }

  login(email: string, mot_de_passe: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, { email, mot_de_passe })
      .pipe(map(response => {
        if (response?.success && response.user) {
          // keep user in sessionStorage by default; caller (component) may move token to localStorage for "remember me"
          sessionStorage.setItem('currentUser', JSON.stringify(response.user));
          if (response.user.session_token) {
            sessionStorage.setItem('session_token', response.user.session_token);
          }
          // if there's already a persistent session_token in localStorage (remember me), keep it
          if (localStorage.getItem('session_token')) {
            // ensure currentUser is also stored persistently
            localStorage.setItem('currentUser', JSON.stringify(response.user));
          }
          this.currentUserSubject.next(response.user);
        }
        return response;
      }));
  }

  extendSession(): Observable<any> {
    const token = this.currentToken;
    if (!token) return of({ success: false, message: 'No session token' });

    // prefer header auth, but server accepts token in body too
    return this.http.post<any>(`http://localhost:3000/api/sessions/extend`, {}, this.getAuthHeaders())
      .pipe(map(response => {
        if (response?.success && response.session) {
          // If server returned updated session token, update storage
          if (response.session.token_session) {
            // update both sessionStorage and localStorage token if present
            sessionStorage.setItem('session_token', response.session.token_session);
            if (localStorage.getItem('session_token')) {
              localStorage.setItem('session_token', response.session.token_session);
            }
          }
        }
        return response;
      }));
  }

  register(userData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, userData);
  }

  registerWithFiles(formData: FormData): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, formData);
  }

  logout(): void {
    const token = this.currentToken;
    if (token) {
      this.http.post(`${this.apiUrl}/logout`, { session_token: token }).subscribe({
        next: () => {},
        error: () => {}
      });
    }

    // clear storages and subject
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('session_token');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('session_token');
    this.currentUserSubject.next(null);
    try { this.router.navigate(['/login']); } catch (e) {}
  }

  verifySession(): Observable<any> {
    const token = this.currentToken;
    if (!token) return of({ success: false });

    return this.http.post<any>(`${this.apiUrl}/verify-session`, { session_token: token })
      .pipe(map(response => {
        if (response?.success && response.user) {
          // keep persistent if token is in localStorage
          const persist = !!localStorage.getItem('session_token');
          if (persist) {
            localStorage.setItem('currentUser', JSON.stringify(response.user));
            if (response.user.session_token) localStorage.setItem('session_token', response.user.session_token);
          } else {
            sessionStorage.setItem('currentUser', JSON.stringify(response.user));
            if (response.user.session_token) sessionStorage.setItem('session_token', response.user.session_token);
          }
          this.currentUserSubject.next(response.user);
        } else {
          // invalid -> logout
          this.logout();
        }
        return response;
      }));
  }

  validateToken(token: string): Observable<any> {
    if (!token) return of({ success: false });
    return this.http.post<any>(`http://localhost:3000/api/sessions/validate`, { session_token: token });
  }

  uploadProfileImage(file: File): Observable<any> {
    const current = this.currentUserValue;
    if (!current) return of({ success: false, message: 'Non authentifié' });

    const fd = new FormData();
    fd.append('image', file);

    const url = `http://localhost:3000/api/utilisateurs/${current.id}/photo`;
    return this.http.post<any>(url, fd, this.getAuthHeaders()).pipe(map(response => {
      if (response?.success && response.photo_url) {
        const updated = { ...current, photo_profil: response.photo_url };
        // persist according to existing storage
        if (localStorage.getItem('currentUser')) localStorage.setItem('currentUser', JSON.stringify(updated));
        sessionStorage.setItem('currentUser', JSON.stringify(updated));
        this.currentUserSubject.next(updated);
      }
      return response;
    }));
  }

  updateProfile(data: any): Observable<any> {
    const current = this.currentUserValue;
    if (!current) return of({ success: false, message: 'Non authentifié' });

    const url = `http://localhost:3000/api/utilisateurs/${current.id}`;
    return this.http.put<any>(url, data, this.getAuthHeaders())
      .pipe(map(response => {
        if (response?.utilisateur) {
          const updated = { ...current, ...response.utilisateur };
          if (localStorage.getItem('currentUser')) localStorage.setItem('currentUser', JSON.stringify(updated));
          sessionStorage.setItem('currentUser', JSON.stringify(updated));
          this.currentUserSubject.next(updated);
        }
        return response;
      }));
  }
}
