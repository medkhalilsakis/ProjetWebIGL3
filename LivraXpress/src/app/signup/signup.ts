// frontend/src/app/features/auth/register/register.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/authentification';
import { ToastService } from '../services/toast';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-register',
  templateUrl: './signup.html',
  styleUrl: './signup.css',
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink]
})
export class Signup implements OnInit {
  registerForm: FormGroup;
  loading = false;
  submitted = false;
  currentStep = 1;
  selectedRole: string = '';
  showPassword = false;
  permisFile: File | null = null;
  carteIdentiteFile: File | null = null;

  roles = [
    { 
      value: 'client', 
      label: 'Client', 
      icon: '👤',
      description: 'Je veux commander des produits'
    },
    { 
      value: 'fournisseur', 
      label: 'Fournisseur', 
      icon: '🏪',
      description: 'Je veux vendre mes produits'
    },
    { 
      value: 'livreur', 
      label: 'Livreur', 
      icon: '🚚',
      description: 'Je veux livrer des commandes'
    }
  ];

  typesVehicule = [
    { value: 'velo', label: 'Vélo' },
    { value: 'moto', label: 'Moto' },
    { value: 'scooter', label: 'Scooter' },
    { value: 'voiture', label: 'Voiture' }
  ];

  typesFournisseur = [
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'supermarche', label: 'Supermarché' },
    { value: 'pharmacie', label: 'Pharmacie' },
    { value: 'fleuriste', label: 'Fleuriste' },
    { value: 'high_tech', label: 'High-Tech' },
    { value: 'autre', label: 'Autre' }
  ];

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private toastService: ToastService
  ) {
    this.registerForm = this.formBuilder.group({
      // Informations de base
      email: ['', [Validators.required, Validators.email]],
      mot_de_passe: ['', [Validators.required, Validators.minLength(6)]],
      confirm_password: ['', [Validators.required]],
      nom_complet: ['', [Validators.required, Validators.minLength(3)]],
      telephone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      role: ['', [Validators.required]],

      // Pour fournisseur
      nom_entreprise: [''],
      type_fournisseur: [''],
      
      // Adresse
      rue: [''],
      code_postal: [''],
      ville: [''],
      latitude: [0],
      longitude: [0],

      // Pour livreur
      type_vehicule: [''],
      numero_permis: [''],
      permis_file: [null],
      carte_identite_file: [null]
    }, {
      validator: this.passwordMatchValidator
    });
  }

  ngOnInit(): void {
    // Ne pas rediriger automatiquement - laisser l'utilisateur accéder à la page d'inscription
    // même s'il est connecté (il peut vouloir créer un autre compte)
    // La redirection se fera seulement après soumission réussie du formulaire
  }

  get f() { return this.registerForm.controls; }

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

  selectRole(role: string): void {
    this.selectedRole = role;
    this.registerForm.patchValue({ role });

    // Ajouter/retirer les validateurs selon le rôle
    if (role === 'fournisseur') {
      this.f['nom_entreprise'].setValidators([Validators.required]);
      this.f['type_fournisseur'].setValidators([Validators.required]);
      this.f['rue'].setValidators([Validators.required]);
      this.f['code_postal'].setValidators([Validators.required]);
      this.f['ville'].setValidators([Validators.required]);
      
      this.f['type_vehicule'].clearValidators();
      this.f['numero_permis'].clearValidators();
    } else if (role === 'livreur') {
      this.f['type_vehicule'].setValidators([Validators.required]);
      this.f['numero_permis'].setValidators([Validators.required]);
      this.f['permis_file'].setValidators([Validators.required]);
      this.f['carte_identite_file'].setValidators([Validators.required]);
      
      this.f['nom_entreprise'].clearValidators();
      this.f['type_fournisseur'].clearValidators();
      this.f['rue'].clearValidators();
      this.f['code_postal'].clearValidators();
      this.f['ville'].clearValidators();
    } else {
      // Client - pas de champs supplémentaires requis
      this.f['nom_entreprise'].clearValidators();
      this.f['type_fournisseur'].clearValidators();
      this.f['type_vehicule'].clearValidators();
      this.f['numero_permis'].clearValidators();
      this.f['permis_file'].clearValidators();
      this.f['carte_identite_file'].clearValidators();
      this.f['rue'].clearValidators();
      this.f['code_postal'].clearValidators();
      this.f['ville'].clearValidators();
    }

    // Mettre à jour les validations
    Object.keys(this.registerForm.controls).forEach(key => {
      this.registerForm.get(key)?.updateValueAndValidity();
    });

    this.nextStep();
  }

  nextStep(): void {
    if (this.currentStep < 3) {
      this.currentStep++;
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onPermisFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        this.toastService.showToast('Le fichier du permis doit être un PDF', 'error');
        event.target.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        this.toastService.showToast('Le fichier du permis ne doit pas dépasser 5MB', 'error');
        event.target.value = '';
        return;
      }
      this.permisFile = file;
      this.registerForm.patchValue({ permis_file: file });
      this.registerForm.get('permis_file')?.updateValueAndValidity();
    }
  }

  onCarteIdentiteFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        this.toastService.showToast('Le fichier de la carte d\'identité doit être un PDF', 'error');
        event.target.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        this.toastService.showToast('Le fichier de la carte d\'identité ne doit pas dépasser 5MB', 'error');
        event.target.value = '';
        return;
      }
      this.carteIdentiteFile = file;
      this.registerForm.patchValue({ carte_identite_file: file });
      this.registerForm.get('carte_identite_file')?.updateValueAndValidity();
    }
  }

  onSubmit(): void {
    this.submitted = true;

    if (this.registerForm.invalid) {
      this.toastService.showToast(
        'Veuillez remplir tous les champs requis',
        'warning'
      );
      return;
    }

    this.loading = true;

    // Pour les livreurs, utiliser FormData pour envoyer les fichiers
    if (this.selectedRole === 'livreur') {
      const formDataToSend = new FormData();
      formDataToSend.append('email', this.f['email'].value);
      formDataToSend.append('mot_de_passe', this.f['mot_de_passe'].value);
      formDataToSend.append('nom_complet', this.f['nom_complet'].value);
      formDataToSend.append('telephone', this.f['telephone'].value);
      formDataToSend.append('role', this.f['role'].value);
      formDataToSend.append('type_vehicule', this.f['type_vehicule'].value);
      formDataToSend.append('numero_permis', this.f['numero_permis'].value);
      
      if (this.permisFile) {
        formDataToSend.append('permis_file', this.permisFile);
      }
      if (this.carteIdentiteFile) {
        formDataToSend.append('carte_identite_file', this.carteIdentiteFile);
      }

      // Envoyer la requête avec FormData
      this.authService.registerWithFiles(formDataToSend).subscribe(
        response => {
          if (response.success) {
            this.toastService.showToast(
              'Inscription réussie ! Votre compte sera activé après vérification de vos documents.',
              'success'
            );
            setTimeout(() => {
              this.router.navigate(['/login']);
            }, 2000);
          } else {
            this.toastService.showToast(
              response.message || 'Erreur lors de l\'inscription',
              'error'
            );
            this.loading = false;
          }
        },
        error => {
          this.toastService.showToast(
            error.error?.message || 'Erreur lors de l\'inscription',
            'error'
          );
          this.loading = false;
        }
      );
      return;
    }

    // Pour les autres rôles, utiliser le format JSON normal
    const formData = {
      email: this.f['email'].value,
      mot_de_passe: this.f['mot_de_passe'].value,
      nom_complet: this.f['nom_complet'].value,
      telephone: this.f['telephone'].value,
      role: this.f['role'].value,
      additional_data: {}
    };

    // Ajouter les données spécifiques selon le rôle
    if (this.selectedRole === 'fournisseur') {
      formData.additional_data = {
        nom_entreprise: this.f['nom_entreprise'].value,
        type_fournisseur: this.f['type_fournisseur'].value,
        adresse: {
          rue: this.f['rue'].value,
          code_postal: this.f['code_postal'].value,
          ville: this.f['ville'].value,
          latitude: this.f['latitude'].value || 33.5731,
          longitude: this.f['longitude'].value || -7.5898
        }
      };
    }

    // Envoyer la requête
    this.authService.register(formData).subscribe(
      response => {
        if (response.success) {
          this.toastService.showToast(
            'Inscription réussie ! Vous pouvez maintenant vous connecter.',
            'success'
          );
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 2000);
        } else {
          this.toastService.showToast(
            response.message || 'Erreur lors de l\'inscription',
            'error'
          );
          this.loading = false;
        }
      },
      error => {
        this.toastService.showToast(
          error.error?.message || 'Erreur lors de l\'inscription',
          'error'
        );
        this.loading = false;
      }
    );
  }
}