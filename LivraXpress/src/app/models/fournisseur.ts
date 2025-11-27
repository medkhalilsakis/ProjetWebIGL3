import { User } from "./user";

export interface Fournisseur extends User {
  nomEntreprise: string;
  type: 'restaurant' | 'supermarche' | 'pharmacie' | 'fleuriste' | 'high_tech' | 'autre';
  adresse: string;
  coordonneesGps: string;
  horaires: any;
  description?: string;
  photoCouverture?: string;
  noteMoyenne: number;
  nombreAvis: number;
  tempsPreparationMoyen: number;
  fraisLivraison: number;
}