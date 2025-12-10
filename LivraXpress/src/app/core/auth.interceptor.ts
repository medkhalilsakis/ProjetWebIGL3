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
    const token =
      sessionStorage.getItem('session_token') ||
      localStorage.getItem('session_token') ||
      sessionStorage.getItem('token') ||
      localStorage.getItem('token') ||
      null;

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
        // lazy inject to avoid circular deps
        const toast = this.injector.get(ToastService);
        const authService = this.injector.get(AuthService);

        if (error.status === 401) {
          try { toast.showToast('Session expirée. Veuillez vous reconnecter.', 'warning'); } catch {}
          try { authService.logout(); } catch {}
          try { this.router.navigate(['/login']); } catch {}
        } else if (error.status === 403) {
          try { toast.showToast('Accès refusé.', 'error'); } catch {}
          const user = (authService as any)?.currentUserValue;
          if (user) try { this.router.navigate([`/${user.role}/dashboard`]); } catch {}
        } else if (error.status === 404) {
          try { toast.showToast('Ressource introuvable.', 'error'); } catch {}
        } else if (error.status === 500) {
          try { toast.showToast('Erreur serveur. Veuillez réessayer plus tard.', 'error'); } catch {}
        } else if (error.status === 0) {
          try { toast.showToast('Impossible de se connecter au serveur.', 'error'); } catch {}
        }

        return throwError(() => error);
      })
    );
  }
}
