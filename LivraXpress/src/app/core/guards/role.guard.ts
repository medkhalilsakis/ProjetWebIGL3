import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../../services/authentification';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const currentUser = this.authService.currentUserValue;

    if (currentUser) {
      // Vérifier si la route requiert un rôle spécifique
      const requiredRole = route.data['role'];

      if (requiredRole && currentUser.role === requiredRole) {
        // Utilisateur a le bon rôle
        return true;
      }

      // Rôle incorrect, rediriger vers le dashboard de l'utilisateur
      this.router.navigate([`/${currentUser.role}/dashboard`]);
      return false;
    }

    // Pas connecté, rediriger vers login
    this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
}