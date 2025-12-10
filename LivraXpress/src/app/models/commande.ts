export interface Order {
  id: string;
  clientId: string;
  fournisseurId: string;
  livreurId?: string;
  statut: 'en_attente' | 'en_preparation' | 'pret_pour_livraison' | 'en_livraison' | 'livree' | 'annulee';
  adresseLivraison: string;
  coordonneesGps: string;
  montantTotal: number;
  fraisService: number;
  fraisLivraison: number;
  instructionsSpeciales?: string;
  modePaiement: 'carte' | 'especes' | 'portefeuille';
  dateCommande: Date;
  dateEstimee?: Date;
  produits: OrderItem[];
}

export interface OrderItem {
  produitId: string;
  nom: string;
  quantite: number;
  prixUnitaire: number;
  options?: any;
}