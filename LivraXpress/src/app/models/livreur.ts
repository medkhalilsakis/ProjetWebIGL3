import { User } from "./user";

export interface Livreur extends User {
  numeroPermis?: string;
  typeVehicule: 'velo' | 'moto' | 'voiture' | 'scooter';
  photoVehicule?: string;
  disponibilite: 'disponible' | 'occupe' | 'en_pause';
  noteMoyenne: number;
  nombreLivraisons: number;
}