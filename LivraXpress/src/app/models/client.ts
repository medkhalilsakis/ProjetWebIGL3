import { User } from "./user";

export interface Client extends User {
  adresseParDefaut?: string;
  coordonneesGps?: string;
  preferences?: any;
}