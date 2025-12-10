import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/authentification';
import { ToastService } from '../services/toast';

@Component({
  selector: 'app-add-admin',
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './add-admin.html',
  styleUrl: './add-admin.css'
})
export class AddAdmin implements OnInit {
  adminForm: FormGroup;
  loading = false;
  submitted = false;
  showPassword = false;
  showConfirmPassword = false;
  
  apiUrl = 'http://localhost:3000/api/admin';

  constructor(
    private formBuilder: FormBuilder,
    private http: HttpClient,
    private auth: AuthService,
    private toast: ToastService,
    private router: Router
  ) {
    this.adminForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      mot_de_passe: ['', [Validators.required, Validators.minLength(8)]],
      confirm_password: ['', [Validators.required]],
      nom_complet: ['', [Validators.required, Validators.minLength(3)]],
      telephone: ['', [Validators.pattern(/^[0-9]{10}$/)]]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  ngOnInit(): void {
    // Vérifier que l'utilisateur est admin
    if (!this.auth.isAuthenticated || this.auth.userRole !== 'admin') {
      this.toast.showToast('Accès refusé. Seuls les administrateurs peuvent ajouter un admin.', 'error');
      this.router.navigate(['/admin/dashboard']);
    }
  }

  get f() {
    return this.adminForm.controls;
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('mot_de_passe');
    const confirmPassword = form.get('confirm_password');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ mismatch: true });
    } else {
      confirmPassword?.setErrors(null);
    }
    
    return null;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  onSubmit(): void {
    this.submitted = true;

    if (this.adminForm.invalid) {
      this.toast.showToast('Veuillez remplir tous les champs correctement', 'warning');
      return;
    }

    this.loading = true;

    const formData = {
      email: this.f['email'].value,
      mot_de_passe: this.f['mot_de_passe'].value,
      nom_complet: this.f['nom_complet'].value,
      telephone: this.f['telephone'].value || null,
      role: 'admin',
      statut: 'actif'
    };

    const authOptions = this.auth.getAuthHeaders();

    this.http.post<{ success: boolean; message?: string; utilisateur?: any }>(
      `${this.apiUrl}/utilisateurs`,
      formData,
      authOptions
    ).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          this.toast.showToast('Administrateur ajouté avec succès !', 'success');
          // Réinitialiser le formulaire
          this.adminForm.reset();
          this.submitted = false;
          // Optionnel : rediriger vers la liste des admins
          setTimeout(() => {
            this.router.navigate(['/admin/dashboard'], { queryParams: { tab: 'admins' } });
          }, 1500);
        } else {
          this.toast.showToast(response.message || 'Erreur lors de l\'ajout de l\'administrateur', 'error');
        }
      },
      error: (err) => {
        this.loading = false;
        const errorMessage = err.error?.message || err.error?.errors?.[0]?.msg || 'Erreur lors de l\'ajout de l\'administrateur';
        this.toast.showToast(errorMessage, 'error');
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/admin/dashboard']);
  }
}
