import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';
import { Login } from './login/login';
import { Signup } from './signup/signup';
import { ClientDashboardComponent } from './client-dashboard/client-dashboard';
import { FournisseurDashboard } from './fournisseur-dashboard/fournisseur-dashboard';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard';
import { AddAdmin } from './add-admin/add-admin';
import { Accueil } from './accueil/accueil';
import { ListProduits } from './list-produits/list-produits';

export const routes: Routes = [

  {
    path: '',
    component: Accueil,
    pathMatch: 'full'
  },

  // 🔑 Auth pages
  { path: 'login', component: Login },
  { path: 'register', component: Signup },

  // 🛍️ Products listing (public)
  { path: 'produits', component: ListProduits },
  { path: 'list-produits', component: ListProduits },

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

  // 👑 Routes protégées admin
  {
    path: 'admin',
    canActivate: [AuthGuard, RoleGuard],
    data: { role: 'admin' },
    children: [
      { path: 'dashboard', component: AdminDashboardComponent },
      { path: 'add-admin', component: AddAdmin },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },

  // 🚫 Page inconnue → redirection vers login
  { path: '**', redirectTo: '/login' }

];
