import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, interval, Subscription, of } from 'rxjs';
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

/** <-- Ajout de l'interface manquante */
interface NotificationResponse {
  success: boolean;
  notifications?: Notification[];
  unread_count?: number;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy {
  fetchNotifications() {
    throw new Error('Method not implemented.');
  }
  private apiUrl = `http://localhost:3000/api/notifications`;
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

    const token = this.authService.currentToken;
    if (!token) {
      console.warn('No session token found. Polling will start when token is available.');
      return;
    }

    // call immediately then every 30s
    this.loadNotifications();

    this.pollingSub = interval(30000).pipe(
      switchMap(() =>
        this.http.get<NotificationResponse>(this.apiUrl, this.authService.getAuthHeaders()).pipe(
          catchError(err => {
            console.error('Erreur polling notifications', err);
            // return un NotificationResponse typé pour que le subscriber reçoive toujours le bon type
            return of({ success: false } as NotificationResponse);
          })
        )
      )
    ).subscribe((resp: NotificationResponse) => {
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

  loadNotifications(limit = 20, offset = 0, lu?: boolean): void {
  const params: any = { limit: String(limit), offset: String(offset) };
  if (lu !== undefined) params.lu = String(lu);

  // getAuthHeaders() retourne { headers?: HttpHeaders }
  const authHeaders = this.authService.getAuthHeaders();
  const headers = authHeaders?.headers ?? undefined;

  // IMPORTANT : observe: 'body' force l'overload qui retourne Observable<NotificationResponse>
  const options = { params, headers, observe: 'body' as const };

  this.http.get<NotificationResponse>(this.apiUrl, options).subscribe({
    next: (resp: NotificationResponse) => {
      if (resp?.success) {
        this.notificationsSubject.next(resp.notifications || []);
        this.unreadCountSubject.next(resp.unread_count ?? 0);
      } else {
        this.toast.showToast(resp?.message || 'Erreur récupération notifications', 'error');
      }
    },
    error: err => {
      console.error('Erreur loadNotifications', err);
      if (err.status === 401) {
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


  getNotifications(limit: number = 20, offset: number = 0): Observable<NotificationResponse> {
    const options = { params: { limit: String(limit), offset: String(offset) }, ...this.authService.getAuthHeaders() };
    return this.http.get<NotificationResponse>(this.apiUrl, options);
  }

  markAsRead(notificationId: string): Observable<NotificationResponse> {
    return this.http.put<NotificationResponse>(`${this.apiUrl}/${notificationId}/read`, {}, this.authService.getAuthHeaders());
  }

  markAllAsRead(): Observable<NotificationResponse> {
    return this.http.put<NotificationResponse>(`${this.apiUrl}/read-all`, {}, this.authService.getAuthHeaders());
  }

  deleteNotification(notificationId: string): Observable<NotificationResponse> {
    return this.http.delete<NotificationResponse>(`${this.apiUrl}/${notificationId}`, this.authService.getAuthHeaders());
  }

  showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info'): void {
    if (this.toast && (this.toast as any).showToast) {
      (this.toast as any).showToast(message, type);
      return;
    }
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
