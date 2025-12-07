// src/app/auth.interceptor.ts
import { Injectable, Injector } from '@angular/core';
import {
  HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../services/authentification';
import { ToastService } from '../services/toast';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(
    private injector: Injector,
    private router: Router
  ) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Récupérer le token depuis sessionStorage OU localStorage, avec quelques clés alternatives
    const token =
      sessionStorage.getItem('session_token') ||
      localStorage.getItem('session_token') ||
      sessionStorage.getItem('token') ||
      localStorage.getItem('token') ||
      null;

    try { console.debug('[AuthInterceptor] token present:', !!token); } catch (e) {}

    if (token) {
      request = request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
          'x-session-token': token
        }
      });
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        const toast = this.injector.get(ToastService);
        const authService = this.injector.get(AuthService);

        if (error.status === 401) {
          toast.showToast('Session expirée. Veuillez vous reconnecter.', 'warning');
          try { authService.logout(); } catch(e) {}
          try { this.router.navigate(['/login']); } catch(e) {}
        } else if (error.status === 403) {
          toast.showToast('Accès refusé.', 'error');
          const user = (authService as any)?.currentUserValue;
          if (user) this.router.navigate([`/${user.role}/dashboard`]);
        } else if (error.status === 404) {
          toast.showToast('Ressource introuvable.', 'error');
        } else if (error.status === 500) {
          toast.showToast('Erreur serveur. Veuillez réessayer plus tard.', 'error');
        } else if (error.status === 0) {
          toast.showToast('Impossible de se connecter au serveur.', 'error');
        }

        return throwError(() => error);
      })
    );
  }
}
