# Implémentation : Système de Vérification des Livreurs

## Vue d'ensemble
Ce document récapitule l'implémentation complète du système de vérification des livreurs dans LivraXpress. Les livreurs doivent maintenant uploader leurs documents (permis de conduire et carte d'identité) au moment de l'inscription, et un administrateur doit vérifier et accepter ou rejeter leur compte.

---

## Modifications Backend (Express.js)

### 1. Routes Admin ajoutées dans `api-express/routes/admin.routes.js`

#### Route GET: `/api/admin/livreurs/en-attente`
- **Description**: Récupère tous les livreurs en attente de vérification
- **Authentification**: Requiert authentification + rôle admin
- **Paramètres de query**:
  - `limit` (optionnel): Nombre d'enregistrements par page (défaut: 50)
  - `offset` (optionnel): Décalage des résultats (défaut: 0)
- **Réponse**: 
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "user_id",
        "email": "livreur@example.com",
        "nom_complet": "Jean Dupont",
        "telephone": "0123456789",
        "type_vehicule": "voiture",
        "numero_permis": "ABC123XYZ",
        "date_creation": "2025-12-11T10:30:00Z",
        "photo_profil": "/uploads/profile/...",
        "documents": [
          {
            "id": "doc_id",
            "type_document": "permis",
            "chemin_fichier": "/uploads/documents/permis_...",
            "date_upload": "2025-12-11T10:30:00Z"
          },
          {
            "id": "doc_id",
            "type_document": "carte_identite",
            "chemin_fichier": "/uploads/documents/carte_...",
            "date_upload": "2025-12-11T10:30:00Z"
          }
        ]
      }
    ],
    "total": 5
  }
  ```

#### Route GET: `/api/admin/livreurs/:livreurId/details`
- **Description**: Récupère les détails complets d'un livreur en attente
- **Authentification**: Requiert authentification + rôle admin
- **Paramètres de route**: `livreurId` (ID du livreur à vérifier)
- **Réponse**: Retourne un objet livreur avec tous ses détails et documents

#### Route PUT: `/api/admin/livreurs/:livreurId/verifier`
- **Description**: Accepte ou rejette un livreur
- **Authentification**: Requiert authentification + rôle admin
- **Paramètres de route**: `livreurId` (ID du livreur à traiter)
- **Corps de la requête**:
  ```json
  {
    "action": "accepter" | "rejeter",
    "raison_rejet": "Optionnel - raison du rejet si action = rejeter"
  }
  ```
- **Effectue**:
  - Change le statut de l'utilisateur à `actif` (si accepté) ou `rejete` (si rejeté)
  - Enregistre l'action dans l'audit si rejeté
- **Réponse**: 
  ```json
  {
    "success": true,
    "message": "Livreur accepté et compte activé",
    "data": {
      "livreurId": "...",
      "newStatus": "actif"
    }
  }
  ```

### 2. Enregistrement des documents
- Les documents sont stockés dans `api-express/uploads/documents/`
- Un enregistrement est créé dans la table `documents_livreurs` avec:
  - `id`: UUID unique
  - `livreur_id`: Référence au livreur
  - `type_document`: 'permis' ou 'carte_identite'
  - `chemin_fichier`: Chemin relatif au fichier uploadé
  - `date_upload`: Timestamp de l'upload

---

## Modifications Frontend (Angular)

### 1. Nouveau Service: `LivraXpress/src/app/services/livreur-verification.ts`

Fournit les méthodes suivantes:

```typescript
// Récupérer les livreurs en attente
getPendingLivreurs(limit: number, offset: number): Observable<PendingLivreursResponse>

// Récupérer les détails d'un livreur
getLivreurDetails(livreurId: string): Observable<LivreurDetailsResponse>

// Accepter un livreur
accepterLivreur(livreurId: string): Observable<VerificationResponse>

// Rejeter un livreur
rejeterLivreur(livreurId: string, raisonRejet?: string): Observable<VerificationResponse>

// Récupérer l'URL d'un document
getDocumentUrl(cheminFichier: string): string
```

### 2. Composant Admin Dashboard modifié

#### Nouvelles propriétés:
- `livreursEnAttente: LivreurDetails[]` - Liste des livreurs en attente
- `selectedLivreurEnAttente: LivreurDetails | null` - Livreur actuellement visualisé
- `showLivreurDetailsModal: boolean` - Contrôle l'affichage du modal
- `raisonRejet: string` - Raison du rejet
- `acceptRejectLoading: boolean` - État de chargement des actions

#### Nouvelles méthodes:
```typescript
// Charger les livreurs en attente
loadLivreursEnAttente(): void

// Afficher les détails d'un livreur
viewLivreurDetails(livreur: LivreurDetails): void

// Fermer le modal de détails
closeLivreurDetailsModal(): void

// Accepter un livreur
accepterLivreur(livreurId: string): void

// Rejeter un livreur
rejeterLivreur(livreurId: string): void

// Récupérer l'URL d'un document
getDocumentUrl(cheminFichier: string): string
```

### 3. Template HTML modifié

#### Section: Livreurs en attente
- Affiche une grille de cartes pour chaque livreur en attente
- Chaque carte affiche:
  - Photo de profil / Avatar
  - Nom, email, téléphone
  - Type de véhicule, numéro de permis
  - Documents uploadés (permis + carte d'identité)
  - Boutons: Accepter, Rejeter, Détails

#### Modal: Détails livreur
- Affiche les informations complètes du livreur
- Section 1: Informations personnelles
- Section 2: Informations de livraison
- Section 3: Documents (avec liens de téléchargement)
- Section 4: Actions de vérification
  - Bouton "Accepter et Activer"
  - Champ de saisie pour raison de rejet
  - Bouton "Rejeter"

### 4. Styles CSS ajoutés

Nouveaux styles pour:
- `.pending-livreurs-section` - Section d'alerte jaune/orange
- `.pending-cards-grid` - Grille responsive
- `.pending-card` - Carte de livreur avec hover
- `.large-modal` - Modal agrandie
- `.livreur-details-container` - Conteneur de détails
- `.details-section` - Sections d'informations
- `.documents-grid` - Grille de documents
- `.document-card` - Carte de document
- `.verification-actions` - Section d'actions

---

## Flux Utilisateur Complet

### Pour un Livreur (Inscription)
1. Accède au formulaire de signup
2. Sélectionne "Livreur" comme rôle
3. Remplit les informations:
   - Email, mot de passe, nom, téléphone
   - Type de véhicule, numéro de permis
4. **Upload ses documents**:
   - Permis de conduire (PDF)
   - Carte d'identité (PDF)
5. Soumet le formulaire
6. Reçoit un message: "Votre compte sera activé après vérification"
7. **Statut initial**: `en_attente` (compte inactif)

### Pour un Administrateur (Vérification)
1. Accède au tableau de bord administrateur
2. Clique sur l'onglet "Livreurs"
3. Voit une section "Livreurs en attente de vérification" avec des cartes
4. Pour chaque livreur en attente:
   - Voit les informations principales
   - Peut **télécharger les documents** (PDF)
   - Peut **accepter** (active le compte immédiatement)
   - Peut **rejeter** (désactive le compte avec raison)
5. En cliquant "Détails":
   - Ouvre un modal avec toutes les informations
   - Voit les détails complets du véhicule
   - Peut télécharger les documents
   - Peut accepter ou rejeter avec raison optionnelle
6. Après action:
   - La liste des livreurs en attente se met à jour
   - Les badges de comptage se mettent à jour
   - Le livreur reçoit un email de notification (optionnel)

---

## Points Techniques Importants

### Authentification
- Les routes admin nécessitent le middleware `authMiddleware` et `checkRole('admin')`
- Le token JWT est automatiquement attaché via `AuthInterceptor`

### Sécurité des Documents
- Les fichiers sont uploadés dans `api-express/uploads/documents/`
- Les chemins de fichier sont stockés en base de données
- Les fichiers sont servis via `/uploads` (config express)
- Ajoutez une validation du type MIME (PDF uniquement)

### Transactions
- L'acceptation/rejet d'un livreur utilise une transaction DB pour garantir la cohérence
- En cas d'erreur, tout est rollback

### Notifications
- Optionnel: Envoyer un email au livreur après acceptation/rejet
- Le raison de rejet pourrait être incluse dans l'email

---

## Configuration Requise

### Tables de Base de Données
Les tables suivantes sont utilisées:
- `utilisateurs` - Données utilisateur
- `livreurs` - Détails du livreur
- `documents_livreurs` - Documents uploadés
- `audit_livreurs` - Historique des rejets (optionnel)

### Variables d'Environnement (optionnel)
```env
UPLOAD_DIR=uploads/documents
MAX_FILE_SIZE=5242880  # 5MB en bytes
ALLOWED_FILE_TYPES=application/pdf
```

---

## Tests Recommandés

### Scénario 1: Inscription d'un livreur
```bash
POST /api/auth/register
Content-Type: multipart/form-data

- email: test@example.com
- mot_de_passe: Password123
- nom_complet: Jean Test
- telephone: 0123456789
- role: livreur
- type_vehicule: voiture
- numero_permis: ABC123XYZ
- permis_file: <PDF file>
- carte_identite_file: <PDF file>
```

### Scénario 2: Admin récupère livreurs en attente
```bash
GET /api/admin/livreurs/en-attente
Authorization: Bearer <admin_token>
```

### Scénario 3: Admin accepte un livreur
```bash
PUT /api/admin/livreurs/{livreur_id}/verifier
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "action": "accepter"
}
```

### Scénario 4: Admin rejette un livreur
```bash
PUT /api/admin/livreurs/{livreur_id}/verifier
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "action": "rejeter",
  "raison_rejet": "Numéro de permis invalide"
}
```

---

## Futures Améliorations

1. **Vérification automatique**: Intégrer une API de vérification de permis
2. **Emails de notification**: Envoyer emails aux livreurs après acceptation/rejet
3. **Rappels**: Envoyer rappels aux livreurs en attente après X jours
4. **Validation OCR**: Valider les documents avec OCR
5. **Historique complet**: Afficher historique des acceptations/rejets
6. **Commentaires admin**: Ajouter champ de commentaires admin
7. **Téléchargement en masse**: Exporter liste des livreurs en attente
8. **Expiration automatique**: Expirer les demandes après 30 jours

---

## Support & Debugging

### Logs recommandés
```typescript
// Dans les routes admin.routes.js
console.log('Livreurs en attente récupérés:', livreurs.length);
console.log('Action de vérification:', action, 'pour livreur:', livreurId);
```

### Erreurs courantes
1. **404 Not Found**: Vérifier que le livreurId existe
2. **403 Forbidden**: Vérifier que l'utilisateur est admin
3. **400 Bad Request**: Vérifier les paramètres de requête
4. **500 Internal Error**: Vérifier les logs du serveur

---

**Date de création**: 11 décembre 2025
**Version**: 1.0
**Statut**: ✅ Implémentation complète
