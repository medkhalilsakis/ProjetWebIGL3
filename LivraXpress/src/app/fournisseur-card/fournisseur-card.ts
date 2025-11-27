import { Component, Input } from '@angular/core';
import { Fournisseur } from '../models/fournisseur';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-fournisseur-card',
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule
  ],
  templateUrl: './fournisseur-card.html',
  styleUrl: './fournisseur-card.css',
})
export class FournisseurCard {
  @Input() fournisseur!: Fournisseur;
}
