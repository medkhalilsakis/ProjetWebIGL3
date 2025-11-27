export interface User {
  id: string;
  email: string;
  nomComplet: string;
  telephone: string;
  role: 'client' | 'fournisseur' | 'livreur' | 'admin';
  statut: 'actif' | 'inactif' | 'suspendu';
  photoProfil?: string;
  createdAt?: Date;
  updatedAt?: Date;
}