export interface Product {
  id: string;
  fournisseurId: string;
  nom: string;
  description?: string;
  prix: number;
  categorie: 'nourriture' | 'courses' | 'pharmacie' | 'fleurs' | 'high_tech' | 'documents';
  sousCategorie?: string;
  imagePrincipale: string;
  imagesAdditionnelles?: string[];
  stock: number;
  disponible: boolean;
  noteMoyenne: number;
  nombreAvis: number;
  tempsPreparation?: number;
}