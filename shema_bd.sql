CREATE SCHEMA IF NOT EXISTS "public";
CREATE TABLE IF NOT EXISTS "public"."admins" (
    "id" character varying(36) NOT NULL,
    "utilisateur_id" character varying(36) NOT NULL,
    "departement" character varying(50),
    "permissions" jsonb,
    "niveau_acces" integer,
    "dernier_acces_admin" timestamp without time zone,
    CONSTRAINT "admins_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admins_utilisateur_id_key" UNIQUE ("utilisateur_id")
);

CREATE TABLE IF NOT EXISTS "public"."adresses" (
    "id" character varying(36) NOT NULL,
    "rue" character varying(255) NOT NULL,
    "complement" character varying(100),
    "code_postal" character varying(20) NOT NULL,
    "ville" character varying(100) NOT NULL,
    "pays" character varying(50),
    "coordonnees_gps" geography NOT NULL,
    "type_adresse" character varying(20),
    "est_principale" boolean,
    "date_creation" timestamp without time zone,
    "derniere_mise_a_jour" timestamp without time zone,
    CONSTRAINT "adresses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."audit_utilisateurs" (
    "id" character varying(36) NOT NULL,
    "utilisateur_id" character varying(36) NOT NULL,
    "action" character varying(20) NOT NULL,
    "ancienne_valeur" jsonb,
    "nouvelle_valeur" jsonb,
    "ip_adresse" character varying(45),
    "user_agent" text,
    "date_action" timestamp without time zone,
    CONSTRAINT "audit_utilisateurs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."avis" (
    "id" character varying(36) NOT NULL,
    "commande_id" character varying(36) NOT NULL,
    "client_id" character varying(36) NOT NULL,
    "fournisseur_id" character varying(36),
    "livreur_id" character varying(36),
    "note_fournisseur" integer,
    "note_livreur" integer,
    "commentaire_fournisseur" text,
    "commentaire_livreur" text,
    "reponse_fournisseur" text,
    "date_avis" timestamp without time zone,
    "public" boolean,
    "images_avis" jsonb,
    CONSTRAINT "avis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" character varying(36) NOT NULL,
    "parent_id" character varying(36),
    "nom" character varying(100) NOT NULL,
    "description" text,
    "icone" character varying(50),
    "ordre_affichage" integer,
    "actif" boolean,
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."client_adresses" (
    "client_id" character varying(36) NOT NULL,
    "adresse_id" character varying(36) NOT NULL,
    "est_principale" boolean,
    "date_ajout" timestamp without time zone,
    "libelle" character varying(50),
    CONSTRAINT "client_adresses_pkey" PRIMARY KEY ("client_id", "adresse_id")
);

CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" character varying(36) NOT NULL,
    "utilisateur_id" character varying(36) NOT NULL,
    "adresse_principale_id" character varying(36),
    "preferences" jsonb,
    "portefeuille" numeric(2),
    "methode_paiement_preferee" character varying(50),
    "notifications_email" boolean,
    "notifications_push" boolean,
    CONSTRAINT "clients_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "clients_utilisateur_id_key" UNIQUE ("utilisateur_id")
);

CREATE TABLE IF NOT EXISTS "public"."commandes" (
    "id" character varying(36) NOT NULL,
    "client_id" character varying(36) NOT NULL,
    "fournisseur_id" character varying(36) NOT NULL,
    "livreur_id" character varying(36),
    "statut" character varying(30),
    "adresse_livraison_id" character varying(36) NOT NULL,
    "montant_total" numeric(2) NOT NULL,
    "frais_service" numeric(2),
    "frais_livraison" numeric(2),
    "instructions_speciales" text,
    "mode_paiement" character varying(20) NOT NULL,
    "reference_paiement" character varying(100),
    "date_commande" timestamp without time zone,
    "date_estimee" timestamp without time zone,
    "date_livraison_reelle" timestamp without time zone,
    "annulation_raison" character varying(255),
    "annulation_par" character varying(36),
    "distance_km" numeric(2),
    "temps_estime_minutes" integer,
    "numero_suivi" character varying(50),
    "statut_paiement" character varying(20),
    "montant_paye" numeric(2),
    "date_paiement" timestamp without time zone,
    CONSTRAINT "commandes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."commandes_archive" (
    "id" character varying(36) NOT NULL,
    "client_id" character varying(36) NOT NULL,
    "fournisseur_id" character varying(36) NOT NULL,
    "livreur_id" character varying(36),
    "statut" character varying(30),
    "adresse_livraison_id" character varying(36) NOT NULL,
    "montant_total" numeric(2) NOT NULL,
    "frais_service" numeric(2),
    "frais_livraison" numeric(2),
    "instructions_speciales" text,
    "mode_paiement" character varying(20) NOT NULL,
    "reference_paiement" character varying(100),
    "date_commande" timestamp without time zone,
    "date_estimee" timestamp without time zone,
    "date_livraison_reelle" timestamp without time zone,
    "annulation_raison" character varying(255),
    "annulation_par" character varying(36),
    "distance_km" numeric(2),
    "temps_estime_minutes" integer,
    "numero_suivi" character varying(50),
    "statut_paiement" character varying(20),
    "montant_paye" numeric(2),
    "date_paiement" timestamp without time zone,
    "date_archivage" timestamp without time zone,
    CONSTRAINT "commandes_archive_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."favoris" (
    "client_id" character varying(36) NOT NULL,
    "fournisseur_id" character varying(36) NOT NULL,
    "date_ajout" timestamp without time zone,
    CONSTRAINT "favoris_pkey" PRIMARY KEY ("client_id", "fournisseur_id")
);

CREATE TABLE IF NOT EXISTS "public"."fournisseur_zones_livraison" (
    "id" character varying(36) NOT NULL,
    "fournisseur_id" character varying(36) NOT NULL,
    "nom_zone" character varying(100) NOT NULL,
    "polygone_coordonnees" geography NOT NULL,
    "frais_supplementaires" numeric(2),
    "temps_estime_supplementaire" integer,
    "actif" boolean,
    CONSTRAINT "fournisseur_zones_livraison_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."fournisseurs" (
    "id" character varying(36) NOT NULL,
    "utilisateur_id" character varying(36) NOT NULL,
    "nom_entreprise" character varying(255) NOT NULL,
    "type_fournisseur" character varying(50) NOT NULL,
    "adresse_id" character varying(36) NOT NULL,
    "horaires_ouverture" jsonb NOT NULL,
    "description" text,
    "photo_couverture" character varying(255),
    "note_moyenne" numeric(2),
    "nombre_avis" integer,
    "temps_preparation_moyen" integer,
    "frais_livraison" numeric(2),
    "statut_verification" character varying(20),
    "documents_verification" jsonb,
    "zone_livraison" geography,
    "capacite_max_commandes" integer,
    "commission_plateforme" numeric(2),
    CONSTRAINT "fournisseurs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fournisseurs_utilisateur_id_key" UNIQUE ("utilisateur_id")
);

CREATE TABLE IF NOT EXISTS "public"."historique_paiements" (
    "id" character varying(36) NOT NULL,
    "paiement_id" character varying(36) NOT NULL,
    "ancien_statut" character varying(20),
    "nouveau_statut" character varying(20) NOT NULL,
    "date_changement" timestamp without time zone,
    "utilisateur_id" character varying(36),
    "commentaire" text,
    CONSTRAINT "historique_paiements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."historique_statuts_commandes" (
    "id" character varying(36) NOT NULL,
    "commande_id" character varying(36) NOT NULL,
    "ancien_statut" character varying(30),
    "nouveau_statut" character varying(30) NOT NULL,
    "date_changement" timestamp without time zone,
    "utilisateur_id" character varying(36),
    "commentaire" text,
    CONSTRAINT "historique_statuts_commandes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."lignes_commande" (
    "id" character varying(36) NOT NULL,
    "commande_id" character varying(36) NOT NULL,
    "produit_id" character varying(36) NOT NULL,
    "quantite" integer NOT NULL,
    "prix_unitaire" numeric(2) NOT NULL,
    "options_selectionnees" jsonb,
    "notes_speciales" text,
    "sous_total" numeric(2),
    CONSTRAINT "lignes_commande_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."livreurs" (
    "id" character varying(36) NOT NULL,
    "utilisateur_id" character varying(36) NOT NULL,
    "numero_permis" character varying(50),
    "type_vehicule" character varying(20) NOT NULL,
    "photo_vehicule" character varying(255),
    "disponibilite" character varying(20),
    "note_moyenne" numeric(2),
    "nombre_livraisons" integer,
    "capacite_charge_kg" numeric(2),
    "rayon_livraison_max_km" integer,
    "dernier_position" geography,
    "heure_disponibilite_debut" time without time zone,
    "heure_disponibilite_fin" time without time zone,
    "vehicule_enregistre" boolean,
    "assurance_valide" boolean,
    CONSTRAINT "livreurs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "livreurs_utilisateur_id_key" UNIQUE ("utilisateur_id")
);

CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" character varying(36) NOT NULL,
    "utilisateur_id" character varying(36) NOT NULL,
    "titre" character varying(255) NOT NULL,
    "message" text NOT NULL,
    "type" character varying(50) NOT NULL,
    "lu" boolean,
    "priorite" character varying(20),
    "lien_action" character varying(255),
    "date_creation" timestamp without time zone,
    "date_lecture" timestamp without time zone,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."paiements" (
    "id" character varying(36) NOT NULL,
    "commande_id" character varying(36) NOT NULL,
    "montant" numeric(2) NOT NULL,
    "mode_paiement" character varying(20) NOT NULL,
    "statut" character varying(20),
    "details_paiement" jsonb,
    "date_creation" timestamp without time zone,
    "date_effective" timestamp without time zone,
    "confirme_par" character varying(36),
    "reference_transaction" character varying(100),
    CONSTRAINT "paiements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "paiements_commande_id_key" UNIQUE ("commande_id")
);

CREATE TABLE IF NOT EXISTS "public"."produits" (
    "id" character varying(36) NOT NULL,
    "fournisseur_id" character varying(36) NOT NULL,
    "categorie_id" character varying(36) NOT NULL,
    "nom" character varying(255) NOT NULL,
    "description" text,
    "prix" numeric(2) NOT NULL,
    "prix_promotion" numeric(2),
    "image_principale" character varying(255) NOT NULL,
    "images_additionnelles" jsonb,
    "stock" integer,
    "disponible" boolean,
    "note_moyenne" numeric(2),
    "nombre_avis" integer,
    "temps_preparation" integer,
    "options_personnalisation" jsonb,
    "tags" text[],
    "promotion_active" boolean,
    "date_debut_promotion" timestamp without time zone,
    "date_fin_promotion" timestamp without time zone,
    CONSTRAINT "produits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."sessions_utilisateurs" (
    "id" character varying(36) NOT NULL,
    "utilisateur_id" character varying(36) NOT NULL,
    "token_session" character varying(255) NOT NULL,
    "adresse_ip" character varying(45),
    "user_agent" text,
    "date_creation" timestamp without time zone,
    "date_expiration" timestamp without time zone NOT NULL,
    "est_active" boolean,
    CONSTRAINT "sessions_utilisateurs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."statistiques_plateforme" (
    "id" character varying(36) NOT NULL,
    "date_statistique" date NOT NULL,
    "type_statistique" character varying(50) NOT NULL,
    "valeur_numerique" numeric(2),
    "valeur_textuelle" text,
    "metadata" jsonb,
    "derniere_mise_a_jour" timestamp without time zone,
    CONSTRAINT "statistiques_plateforme_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "statistiques_plateforme_date_statistique_type_statistique_key" UNIQUE ("date_statistique", "type_statistique")
);

CREATE TABLE IF NOT EXISTS "public"."utilisateurs" (
    "id" character varying(36) NOT NULL,
    "email" character varying(255) NOT NULL,
    "mot_de_passe" character varying(255) NOT NULL,
    "nom_complet" character varying(255) NOT NULL,
    "telephone" character varying(20) NOT NULL,
    "role" character varying(20) NOT NULL,
    "statut" character varying(20),
    "photo_profil" character varying(255),
    "date_creation" timestamp without time zone,
    "derniere_connexion" timestamp without time zone,
    "reset_token" character varying(255),
    "reset_expires" timestamp without time zone,
    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "utilisateurs_email_key" UNIQUE ("email")
);


-- Foreign key constraints

ALTER TABLE "public"."admins" ADD CONSTRAINT "admins_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."avis" ADD CONSTRAINT "avis_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."avis" ADD CONSTRAINT "avis_commande_id_fkey" FOREIGN KEY ("commande_id") REFERENCES "public"."commandes" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."avis" ADD CONSTRAINT "avis_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "public"."fournisseurs" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE "public"."avis" ADD CONSTRAINT "avis_livreur_id_fkey" FOREIGN KEY ("livreur_id") REFERENCES "public"."livreurs" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE "public"."categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE "public"."client_adresses" ADD CONSTRAINT "client_adresses_adresse_id_fkey" FOREIGN KEY ("adresse_id") REFERENCES "public"."adresses" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."client_adresses" ADD CONSTRAINT "client_adresses_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."clients" ADD CONSTRAINT "clients_adresse_principale_id_fkey" FOREIGN KEY ("adresse_principale_id") REFERENCES "public"."adresses" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE "public"."clients" ADD CONSTRAINT "clients_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."commandes" ADD CONSTRAINT "commandes_adresse_livraison_id_fkey" FOREIGN KEY ("adresse_livraison_id") REFERENCES "public"."adresses" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
ALTER TABLE "public"."commandes" ADD CONSTRAINT "commandes_annulation_par_fkey" FOREIGN KEY ("annulation_par") REFERENCES "public"."utilisateurs" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE "public"."commandes" ADD CONSTRAINT "commandes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."commandes" ADD CONSTRAINT "commandes_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "public"."fournisseurs" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."commandes" ADD CONSTRAINT "commandes_livreur_id_fkey" FOREIGN KEY ("livreur_id") REFERENCES "public"."livreurs" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE "public"."favoris" ADD CONSTRAINT "favoris_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."favoris" ADD CONSTRAINT "favoris_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "public"."fournisseurs" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."fournisseur_zones_livraison" ADD CONSTRAINT "fournisseur_zones_livraison_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "public"."fournisseurs" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."fournisseurs" ADD CONSTRAINT "fournisseurs_adresse_id_fkey" FOREIGN KEY ("adresse_id") REFERENCES "public"."adresses" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."fournisseurs" ADD CONSTRAINT "fournisseurs_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."historique_paiements" ADD CONSTRAINT "historique_paiements_paiement_id_fkey" FOREIGN KEY ("paiement_id") REFERENCES "public"."paiements" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."historique_paiements" ADD CONSTRAINT "historique_paiements_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE "public"."historique_statuts_commandes" ADD CONSTRAINT "historique_statuts_commandes_commande_id_fkey" FOREIGN KEY ("commande_id") REFERENCES "public"."commandes" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."historique_statuts_commandes" ADD CONSTRAINT "historique_statuts_commandes_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE "public"."lignes_commande" ADD CONSTRAINT "lignes_commande_commande_id_fkey" FOREIGN KEY ("commande_id") REFERENCES "public"."commandes" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."lignes_commande" ADD CONSTRAINT "lignes_commande_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "public"."produits" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."livreurs" ADD CONSTRAINT "livreurs_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."paiements" ADD CONSTRAINT "paiements_commande_id_fkey" FOREIGN KEY ("commande_id") REFERENCES "public"."commandes" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."paiements" ADD CONSTRAINT "paiements_confirme_par_fkey" FOREIGN KEY ("confirme_par") REFERENCES "public"."utilisateurs" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE "public"."produits" ADD CONSTRAINT "produits_categorie_id_fkey" FOREIGN KEY ("categorie_id") REFERENCES "public"."categories" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE "public"."produits" ADD CONSTRAINT "produits_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "public"."fournisseurs" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."sessions_utilisateurs" ADD CONSTRAINT "sessions_utilisateurs_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;