import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../services/authentification';
import { Router } from '@angular/router';
@Component({
  selector: 'app-signin',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    CommonModule
  ],
  templateUrl: './signin.html',
  styleUrl: './signin.css',
})
export class Signin {
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  hidePassword = signal(true);

  signInForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    role: new FormControl<'client' | 'fournisseur' | 'livreur'>('client', Validators.required)
  });

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit(): void {
    if (this.signInForm.invalid) {
      this.signInForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { email, password, role } = this.signInForm.value;

    this.authService.login(email!, password!, role!)
      .subscribe({
        next: (response) => {
          localStorage.setItem('token', response.token);
          localStorage.setItem('user', JSON.stringify(response.user));
          this.router.navigate([this.getDashboardPath(role!)]);
        },
        error: (error) => {
          this.errorMessage.set('Identifiants incorrects ou compte non activé');
          this.isLoading.set(false);
        }
      });
  }

  getDashboardPath(role: string): string {
    switch (role) {
      case 'client': return '/client/dashboard';
      case 'fournisseur': return '/fournisseur/dashboard';
      case 'livreur': return '/livreur/dashboard';
      case 'admin': return '/admin/dashboard';
      default: return '/client/dashboard';
    }
  }

  get email() { return this.signInForm.get('email'); }
  get password() { return this.signInForm.get('password'); }
  get role() { return this.signInForm.get('role'); }
}