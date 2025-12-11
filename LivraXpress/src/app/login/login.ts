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
  returnUrl: string = '/';
  showPassword = false;
  permitNotVerified = false;
  permitMessage = '';

  constructor(
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private toastService: ToastService
  ) {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      mot_de_passe: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false]
    });
  }

  ngOnInit(): void {
    try {
      if (this.authService?.isAuthenticated) {
        const role = this.authService.userRole || (this.authService.currentUserValue?.role) || 'client';
        this.router.navigate([`/${role}/dashboard`], { replaceUrl: true });
        return;
      }
    } catch (e) {
      
    }

    const candidate = this.route.snapshot.queryParams['returnUrl'];
    if (candidate && typeof candidate === 'string' && candidate.startsWith('/')) {
      this.returnUrl = candidate;
    } else {
      this.returnUrl = '/';
    }
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

    const email = this.f['email'].value;
    const mot_de_passe = this.f['mot_de_passe'].value;
    const rememberMe = !!this.f['rememberMe'].value;

    this.authService.login(email, mot_de_passe).subscribe(
      response => {
        this.loading = false;

        if (response?.success) {
          this.toastService.showToast('Connexion réussie !', 'success');

          // store token depending on "remember me"
          try {
            const token = response?.user?.session_token || this.authService.currentToken;
            if (token) {
              if (rememberMe) {
                localStorage.setItem('session_token', token);
              } else {
                sessionStorage.setItem('session_token', token);
                // remove from localStorage if it existed
                localStorage.removeItem('session_token');
              }
            }
          } catch (e) {
            // ignore storage errors (e.g. Safari private mode)
          }

          // Determine role (prefer AuthService current user)
          const current = this.authService.currentUserValue ?? response.user;
          const role = current?.role || 'client';

          // If returnUrl set and safe (starts with /), go there, else default dashboard
          const go = (this.returnUrl && this.returnUrl !== '/' && this.returnUrl.startsWith('/'))
            ? this.returnUrl
            : `/${role}/dashboard`;

          this.router.navigate([go], { replaceUrl: true });
        } else {
          // backend success=false with message
          const msg = response?.message || 'Email ou mot de passe incorrect';
          this.toastService.showToast(msg, 'error');
        }
      },
      err => {
        this.loading = false;
        const errorCode = err?.error?.code;
        const serverMsg = err?.error?.message || 'Email ou mot de passe incorrect';
        
        // Special handling for permit not verified
        if (errorCode === 'PERMIT_NOT_VERIFIED') {
          this.permitNotVerified = true;
          this.permitMessage = serverMsg;
          this.toastService.showToast(serverMsg, 'warning');
        } else {
          this.permitNotVerified = false;
          this.permitMessage = '';
          this.toastService.showToast(serverMsg, 'error');
        }
      }
    );
  }
}