import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';
import { Login } from './login/login';
import { Signup } from './signup/signup';
import { ClientDashboardComponent } from './client-dashboard/client-dashboard';
import { FournisseurDashboard } from './fournisseur-dashboard/fournisseur-dashboard';
import { Accueil } from './accueil/accueil';

export const routes: Routes = [

  {
    path: '',
    component: Accueil,
    pathMatch: 'full'
  },

  // 🔑 Auth pages
  { path: 'login', component: Login },
  { path: 'register', component: Signup },

  // 🧑‍💼 Routes protégées client
  {
    path: 'client',
    canActivate: [AuthGuard, RoleGuard],
    data: { role: 'client' },
    children: [
      { path: 'dashboard', component: ClientDashboardComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },

  // 🏪 Routes protégées fournisseur
  {
    path: 'fournisseur',
    canActivate: [AuthGuard, RoleGuard],
    data: { role: 'fournisseur' },
    children: [
      { path: 'dashboard', component: FournisseurDashboard },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },

  // 🚫 Page inconnue → redirection vers login
  { path: '**', redirectTo: '/login' }

];
