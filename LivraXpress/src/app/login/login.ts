import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../services/authentification';
import { ToastService } from '../services/toast';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  loginForm: FormGroup;
  loading = false;
  submitted = false;
  returnUrl: string = '';
  showPassword = false;

  constructor(
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private toastService: ToastService
  ) {
    // Rediriger si déjà connecté
    if (this.authService.isAuthenticated) {
      const role = this.authService.userRole;
      this.router.navigate([`/${role}/dashboard`]);
    }

    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      mot_de_passe: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
  }

  get f() { return this.loginForm.controls; }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    this.submitted = true;

    if (this.loginForm.invalid) {
      return;
    }

    this.loading = true;

    this.authService.login(
      this.f['email'].value,
      this.f['mot_de_passe'].value
    ).subscribe(
      response => {
        if (response.success) {
          this.toastService.showToast('Connexion réussie !', 'success');
          try {
            // Ensure token is stored (fallback)
            if (response.user && response.user.session_token && !sessionStorage.getItem('session_token')) {
              sessionStorage.setItem('session_token', response.user.session_token);
            }
            console.debug('[Login] response.user:', response.user);
          } catch (e) {}

          // Prefer the value from AuthService (guaranteed to be up-to-date), fallback to response.user
          const current = this.authService.currentUserValue ?? response.user;
          const role = current?.role || 'client';
          // Use replaceUrl to avoid leaving login in history
          this.router.navigate([`/${role}/dashboard`], { replaceUrl: true });
          
          // Rediriger selon le rôle
          

        } else {
          this.toastService.showToast(response.message, 'error');
          this.loading = false;
        }
      },
      error => {
        this.toastService.showToast(
          'Email ou mot de passe incorrect', 
          'error'
        );
        this.loading = false;
      }
    );
  }
}
