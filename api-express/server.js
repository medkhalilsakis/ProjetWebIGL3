const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const fileUpload = require('express-fileupload');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware globaux
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: 'http://localhost:4200',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  abortOnLimit: true,
  createParentPath: true
}));

// Servir les fichiers statiques (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const authRoutes = require('./routes/auth.routes');
const notificationRoutes = require('./routes/notification.routes').router;
const commandeRoutes = require('./routes/commande.routes');
const utilisateurRoutes = require('./routes/utilisateurs.routes');
const fournisseurRoutes = require('./routes/fournisseur.routes');
const produitRoutes = require('./routes/produit.routes');
const clientRoutes = require('./routes/client.routes');
const livreurRoutes = require('./routes/livreur.routes');
const adminRoutes = require('./routes/admin.routes');
const categorieRoutes = require('./routes/categorie.routes');
const favorisRoutes = require('./routes/favoris.routes');
const adressesRoutes = require('./routes/adresses.routes');
const avisRoutes = require('./routes/avis.routes');
const paiementsRoutes = require('./routes/paiements.routes');
const historiquePaiementsRoutes = require('./routes/historique_paiements.routes');
const historiqueStatutsRoutes = require('./routes/historique_statuts_commandes.routes');
const auditRoutes = require('./routes/audit_utilisateurs.routes');
const commandesArchiveRoutes = require('./routes/commandes_archive.routes');
const statistiquesRoutes = require('./routes/statistiques.routes');
const sessionsRoutes = require('./routes/sessions_utilisateurs.routes');

// Utilisation des routes
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/commandes', commandeRoutes);
app.use('/api/utilisateurs', utilisateurRoutes);
app.use('/api/fournisseur', fournisseurRoutes);
app.use('/api/produits', produitRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/livreur', livreurRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/categories', categorieRoutes);
app.use('/api/favoris', favorisRoutes);
app.use('/api/adresses', adressesRoutes);
app.use('/api/avis', avisRoutes);
app.use('/api/paiements', paiementsRoutes);
app.use('/api/historique-paiements', historiquePaiementsRoutes);
app.use('/api/historique-statuts', historiqueStatutsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/commandes-archive', commandesArchiveRoutes);
app.use('/api/statistiques', statistiquesRoutes);
app.use('/api/sessions', sessionsRoutes);

// Middleware de gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erreur serveur'
  });
});

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});
