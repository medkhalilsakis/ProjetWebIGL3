# Guide de Débogage : Système de Vérification des Livreurs

## Erreurs Courantes et Solutions

### Erreur 1: "Cannot GET /api/admin/livreurs/en-attente"

**Cause**: La route n'existe pas ou n'est pas enregistrée

**Solution**:
1. Vérifier que `admin.routes.js` contient la route
2. Vérifier que le route est enregistrée dans `server.js`:
   ```javascript
   app.use('/api/admin', adminRoutes);
   ```
3. Redémarrer le serveur backend
4. Vérifier que l'URL est correcte: `http://localhost:3000/api/admin/livreurs/en-attente`

---

### Erreur 2: "401 Unauthorized"

**Cause**: Token manquant ou invalide

**Solution**:
1. Vérifier que le token JWT est stocké dans sessionStorage
2. Vérifier que `AuthInterceptor` ajoute le header `Authorization`
3. Vérifier que le token n'a pas expiré
4. Vérifier dans les DevTools (Network tab) que le header est présent:
   ```
   Authorization: Bearer <token>
   ```
5. Se reconnecter si le token a expiré

---

### Erreur 3: "403 Forbidden"

**Cause**: L'utilisateur n'est pas admin

**Solution**:
1. Vérifier que l'utilisateur a le rôle 'admin'
2. Vérifier la base de données:
   ```sql
   SELECT role FROM utilisateurs WHERE email = 'admin@example.com';
   ```
3. Le rôle doit être exactement 'admin' (case-sensitive)

---

### Erreur 4: "La liste des livreurs ne s'affiche pas"

**Cause**: Le service n'est pas injecté ou la méthode n'est pas appelée

**Solution**:
1. Vérifier que le service est injecté dans le constructeur:
   ```typescript
   constructor(
     private livreurVerificationService: LivreurVerificationService
   ) {}
   ```
2. Vérifier que `loadLivreursEnAttente()` est appelée dans `loadDashboardData()`:
   ```typescript
   loadDashboardData(): void {
     // ...
     this.loadLivreursEnAttente();
     // ...
   }
   ```
3. Vérifier dans les DevTools Console pour les erreurs
4. Vérifier que le backend retourne les données correctement

---

### Erreur 5: "Les documents ne s'affichent pas"

**Cause**: Les documents ne sont pas téléchargés ou les chemins sont incorrects

**Solution**:
1. Vérifier dans la base de données:
   ```sql
   SELECT * FROM documents_livreurs WHERE livreur_id = '<livreur_id>';
   ```
2. Vérifier que le dossier existe:
   ```bash
   ls -la api-express/uploads/documents/
   ```
3. Vérifier que les permissions sont correctes:
   ```bash
   chmod 755 api-express/uploads/documents/
   ```
4. Vérifier que le chemin du fichier est correct dans l'URL:
   ```
   http://localhost:3000/uploads/documents/permis_...
   ```
5. Vérifier dans les logs du serveur si l'upload a échoué

---

### Erreur 6: "Erreur lors du téléchargement du document"

**Cause**: Le serveur ne sert pas les fichiers statiques

**Solution**:
1. Vérifier dans `server.js` que les fichiers statiques sont configurés:
   ```javascript
   app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
   ```
2. Vérifier que les fichiers existent réellement
3. Tester directement dans le navigateur:
   ```
   http://localhost:3000/uploads/documents/nom_du_fichier.pdf
   ```
4. Vérifier les permissions des fichiers

---

### Erreur 7: "Cannot read property 'livreur_id' of undefined"

**Cause**: L'objet livreur n'a pas la propriété `livreur_id`

**Solution**:
1. Vérifier la structure de réponse du serveur
2. Vérifier que l'API retourne `livreur_id`
3. Utiliser l'opérateur `||` pour fallback:
   ```typescript
   livreurId || livreur.id
   ```
4. Vérifier dans le Network tab la réponse exacte

---

### Erreur 8: "Modal ne s'ouvre pas"

**Cause**: La propriété `showLivreurDetailsModal` n'est pas mise à jour

**Solution**:
1. Vérifier que le bouton appelle la bonne méthode:
   ```html
   <button (click)="viewLivreurDetails(livreur)">
   ```
2. Vérifier que la méthode met à jour les propriétés:
   ```typescript
   viewLivreurDetails(livreur: LivreurDetails): void {
     this.selectedLivreurEnAttente = livreur;
     this.showLivreurDetailsModal = true;
   }
   ```
3. Vérifier le template du modal:
   ```html
   <div *ngIf="showLivreurDetailsModal && selectedLivreurEnAttente" class="modal-overlay">
   ```

---

### Erreur 9: "Les boutons Accepter/Rejeter ne répondent pas"

**Cause**: Les événements click ne sont pas liés correctement

**Solution**:
1. Vérifier la syntaxe du click handler:
   ```html
   <button (click)="accepterLivreur(livreur.livreur_id)">
   ```
2. Vérifier que les IDs livreur sont passés correctement
3. Vérifier dans les DevTools Console pour les erreurs
4. Vérifier que `acceptRejectLoading` est bien géré
5. Ajouter des logs:
   ```typescript
   accepterLivreur(livreurId: string): void {
     console.log('Acceptation du livreur:', livreurId);
     // ...
   }
   ```

---

### Erreur 10: "Table documents_livreurs n'existe pas"

**Cause**: La table n'a pas été créée

**Solution**:
1. Créer manuellement la table:
   ```sql
   CREATE TABLE IF NOT EXISTS documents_livreurs (
     id VARCHAR(36) PRIMARY KEY,
     livreur_id VARCHAR(36) NOT NULL,
     type_document VARCHAR(50) NOT NULL,
     chemin_fichier VARCHAR(500) NOT NULL,
     date_upload TIMESTAMP DEFAULT NOW(),
     FOREIGN KEY (livreur_id) REFERENCES livreurs(id) ON DELETE CASCADE
   );
   ```
2. Vérifier que la table existe:
   ```sql
   \dt documents_livreurs;
   ```

---

## Logs Utiles pour le Debugging

### Backend (console Node.js)
```
[INFO] Livreurs en attente récupérés: 5
[INFO] Documents pour livreur ABC: 2
[INFO] Action de vérification: accepter pour livreur: XYZ123
[ERROR] Erreur lors de la vérification: ...
```

### Frontend (Console du Navigateur)
```
getPendingLivreurs() called
Response: {success: true, data: [...]}
User attempting to accept livreur: ABC123
Accept request completed successfully
```

### Network Tab (Requêtes)
```
GET /api/admin/livreurs/en-attente - 200 OK
PUT /api/admin/livreurs/ABC123/verifier - 200 OK
```

---

## Tests manuels rapides

### 1. Vérifier que la route fonctionne
```bash
# Avec un token valide
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/admin/livreurs/en-attente
```

### 2. Vérifier que les documents existent
```bash
ls -la api-express/uploads/documents/
find api-express/uploads/documents/ -type f
```

### 3. Vérifier la base de données
```sql
SELECT COUNT(*) FROM utilisateurs WHERE statut = 'en_attente' AND role = 'livreur';
SELECT * FROM documents_livreurs LIMIT 5;
```

### 4. Vérifier le stockage du navigateur
```javascript
// Dans la console du navigateur
sessionStorage.getItem('session_token')
sessionStorage.getItem('currentUser')
```

---

## Performance et Optimisations

### Si la liste se charge lentement
1. Ajouter une pagination:
   ```typescript
   getPendingLivreurs(limit: 10, offset: 0)
   ```
2. Ajouter une limite dans la requête SQL:
   ```sql
   LIMIT 50 OFFSET 0
   ```
3. Ajouter des index de base de données:
   ```sql
   CREATE INDEX idx_utilisateurs_statut_role 
   ON utilisateurs(statut, role);
   ```

### Si la modale se met à jour lentement
1. Utiliser `trackBy` dans les boucles `ngFor`
2. Implémenter `OnPush` change detection
3. Utiliser `async` pipe pour les observables

---

## Checklist de Débogage

Quand quelque chose ne marche pas:
- [ ] Vérifier les logs du serveur (`npm start`)
- [ ] Vérifier la console du navigateur (F12)
- [ ] Vérifier le Network tab (requêtes HTTP)
- [ ] Vérifier que le token est valide
- [ ] Vérifier que l'utilisateur est admin
- [ ] Vérifier que les chemins sont corrects
- [ ] Vérifier que les fichiers existent
- [ ] Vérifier la base de données
- [ ] Redémarrer le serveur
- [ ] Clear le cache du navigateur (Ctrl+Shift+Delete)
- [ ] Vérifier les ports (3000 pour API, 4200 pour Frontend)

---

**Dernière mise à jour**: 11 décembre 2025
**Version**: 1.0
