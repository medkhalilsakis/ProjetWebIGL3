import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, interval, Subscription } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { AuthService } from './authentification'; 
import { ToastService } from './toast';

export interface Notification {
  id: string;
  utilisateur_id: string;
  titre: string;
  message: string;
  type: string;
  lu: boolean;
  priorite: string;
  lien_action: string | null;
  date_creation: string;
  date_lecture: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy {
  private apiUrl = `http://localhost:3000/api/notifications`; // <-- CORRECT
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  private unreadCountSubject = new BehaviorSubject<number>(0);

  public notifications$ = this.notificationsSubject.asObservable();
  public unreadCount$ = this.unreadCountSubject.asObservable();

  private pollingSub?: Subscription;
  private authSub?: Subscription;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private toast: ToastService 
  ) {

    this.authSub = this.authService.currentUser.subscribe(user => {
      if (user) this.startPolling();
      else this.stopPolling();
    });
  }

  private startPolling(): void {
    if (this.pollingSub && !this.pollingSub.closed) return;
    
    // Verify token exists before starting polling
    const token = sessionStorage.getItem('session_token');
    if (!token) {
      console.warn('No session token found. Polling will start when token is available.');
      return;
    }
    
    // call immediately and then every 30s
    this.loadNotifications();
    this.pollingSub = interval(30000).pipe(
      switchMap(() => this.http.get<any>(this.apiUrl).pipe(
        catchError(err => {
          // handle error locally (don't break the stream)
          console.error('Erreur polling notifications', err);
          return [ { success: false } as any ];
        })
      ))
    ).subscribe((resp: any) => {
      if (resp && resp.success) {
        this.notificationsSubject.next(resp.notifications || []);
        this.unreadCountSubject.next(resp.unread_count ?? 0);
      }
    });
  }

  private stopPolling(): void {
    if (this.pollingSub) {
      this.pollingSub.unsubscribe();
      this.pollingSub = undefined;
    }
    this.notificationsSubject.next([]);
    this.unreadCountSubject.next(0);
  }

  // chargement manuel (ex: onClick pour refresh)
  loadNotifications(limit = 20, offset = 0, lu?: boolean): void {
    const params: any = { limit, offset };
    if (lu !== undefined) params.lu = lu;
    this.http.get<any>(this.apiUrl, { params }).subscribe({
      next: resp => {
        if (resp?.success) {
          this.notificationsSubject.next(resp.notifications || []);
          this.unreadCountSubject.next(resp.unread_count ?? 0);
        } else {
          // Erreur métier
          this.toast.showToast(resp.message || 'Erreur récupération notifications', 'error');
        }
      },
      error: err => {
        console.error('Erreur loadNotifications', err);
        if (err.status === 401) {
          // token invalide -> logout
          this.toast.showToast('Session expirée. Veuillez vous reconnecter.', 'warning');
          this.authService.logout();
        } else if (err.status === 404) {
          this.toast.showToast('Notifications introuvables.', 'error');
        } else {
          this.toast.showToast('Impossible de charger les notifications.', 'error');
        }
      }
    });
  }

  getNotifications(limit: number = 20, offset: number = 0): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}?limit=${limit}&offset=${offset}`);
  }

  markAsRead(notificationId: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${notificationId}/read`, {});
  }

  markAllAsRead(): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/read-all`, {});
  }

  deleteNotification(notificationId: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${notificationId}`);
  }

  // toast helper si tu n'as pas de service externe
  showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info'): void {
    // délègue si tu as un service global, sinon re-utilise la méthode existante
    if (this.toast && (this.toast as any).showToast) {
      (this.toast as any).showToast(message, type);
      return;
    }
    // fallback DOM (ton implémentation d'origine)
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<div class="toast-content"><span class="toast-icon">${this.getToastIcon(type)}</span><span class="toast-message">${message}</span></div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => document.body.removeChild(toast), 300); }, 4000);
  }

  private getToastIcon(type: string): string {
    const icons: Record<string, string> = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    return icons[type] ?? '';
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.authSub?.unsubscribe();
  }
}
