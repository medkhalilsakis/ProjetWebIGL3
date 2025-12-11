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
import { LivreurDashboardComponent } from './livreur-dashboard/livreur-dashboard';

export const routes: Routes = [

  {
    path: '',
    component: Accueil,
    pathMatch: 'full'
  },


  { path: 'login', component: Login },
  { path: 'register', component: Signup },

  { path: 'produits', component: ListProduits },
  { path: 'list-produits', component: ListProduits },

  {
    path: 'client',
    canActivate: [AuthGuard, RoleGuard],
    data: { role: 'client' },
    children: [
      { path: 'dashboard', component: ClientDashboardComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },

  {
    path: 'fournisseur',
    canActivate: [AuthGuard, RoleGuard],
    data: { role: 'fournisseur' },
    children: [
      { path: 'dashboard', component: FournisseurDashboard },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },

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

  // 🚚 Routes protégées livreur
  {
    path: 'livreur',
    canActivate: [AuthGuard, RoleGuard],
    data: { role: 'livreur' },
    children: [
      { path: 'dashboard', component: LivreurDashboardComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },

  // 🚫 Page inconnue → redirection vers login
  { path: '**', redirectTo: '/login' }

];
