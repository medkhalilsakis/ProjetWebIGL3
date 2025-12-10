// backend/routes/commande.routes.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authMiddleware, checkRole } = require('../middleware/auth.middleware');
const { createNotification, notificationTypes } = require('./notification.routes');

/**
 * POST / - créer commande (client)
 */
router.post('/', authMiddleware, checkRole('client'), async (req, res) => {
  let client;
  try {
    client = await db.connect();

    const {
      fournisseur_id,
      adresse_livraison_id,
      produits, // [{produit_id, quantite, options_selectionnees}]
      instructions_speciales,
      mode_paiement
    } = req.body;

    if (!Array.isArray(produits) || produits.length === 0) {
      return res.status(400).json({ success: false, message: 'Produits requis' });
    }
    await client.query('BEGIN');

    // Récupérer l'ID client
    const clientResult = await client.query('SELECT id FROM clients WHERE utilisateur_id = $1', [req.user.user_id]);
    if (clientResult.rowCount === 0) throw new Error('Client introuvable');
    const clientId = clientResult.rows[0].id;

    // Vérifier fournisseur
    const fournisseurRes = await client.query('SELECT id, frais_livraison FROM fournisseurs WHERE id = $1', [fournisseur_id]);
    if (fournisseurRes.rowCount === 0) throw new Error('Fournisseur introuvable');
    const fraisLivraison = parseFloat(fournisseurRes.rows[0].frais_livraison) || 0;

    // Calculer montant total
    let montantProduits = 0;
    for (const prod of produits) {
      if (!prod.produit_id || !prod.quantite || prod.quantite <= 0) {
        throw new Error('Produit invalide ou quantité manquante');
      }
      const prodRes = await client.query('SELECT prix, disponible FROM produits WHERE id = $1', [prod.produit_id]);
      if (prodRes.rowCount === 0) throw new Error(`Produit introuvable: ${prod.produit_id}`);
      if (prodRes.rows[0].disponible === false) throw new Error(`Produit non disponible: ${prod.produit_id}`);
      const prixUnitaire = parseFloat(prodRes.rows[0].prix) || 0;
      montantProduits += prixUnitaire * Number(prod.quantite);
    }

    const fraisService = montantProduits * 0.05; // 5%
    const montantTotal = Number((montantProduits + fraisLivraison + fraisService).toFixed(2));

    const commandeId = uuidv4();

    await client.query(
      `INSERT INTO commandes 
       (id, client_id, fournisseur_id, adresse_livraison_id, montant_total, frais_service, frais_livraison, instructions_speciales, mode_paiement, statut, date_commande)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'en_attente', NOW())`,
      [commandeId, clientId, fournisseur_id, adresse_livraison_id, montantTotal, fraisService, fraisLivraison, instructions_speciales || null, mode_paiement || null]
    );

    // lignes_commande
    for (const prod of produits) {
      const prodRes = await client.query('SELECT prix FROM produits WHERE id = $1', [prod.produit_id]);
      const prixUnitaire = parseFloat(prodRes.rows[0].prix) || 0;
      await client.query(
        `INSERT INTO lignes_commande 
         (id, commande_id, produit_id, quantite, prix_unitaire, options_selectionnees)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [uuidv4(), commandeId, prod.produit_id, parseInt(prod.quantite, 10), prixUnitaire, prod.options_selectionnees ? JSON.stringify(prod.options_selectionnees) : null]
      );
    }

    // Paiement (en_attente)
    const paiementId = uuidv4();
    await client.query(
      `INSERT INTO paiements (id, commande_id, montant, mode_paiement, statut, created_at)
       VALUES ($1, $2, $3, $4, 'en_attente', NOW())`,
      [paiementId, commandeId, montantTotal, mode_paiement || 'unknown']
    );

    // historiser statut initial
    await client.query(
      `INSERT INTO historique_statuts_commandes (id, commande_id, ancien_statut, nouveau_statut, date_changement)
       VALUES ($1, $2, $3, $4, NOW())`,
      [uuidv4(), commandeId, null, 'en_attente']
    );

    // récupérer utilisateur du fournisseur pour notification
    const fournisseurResult = await client.query('SELECT utilisateur_id FROM fournisseurs WHERE id = $1', [fournisseur_id]);

    await client.query('COMMIT');

    // notification fournisseur (hors transaction)
    if (fournisseurResult.rowCount > 0) {
      const notifData = notificationTypes.NOUVELLE_COMMANDE(commandeId.substring(0, 8), montantTotal.toFixed(2));
      await createNotification(fournisseurResult.rows[0].utilisateur_id, notifData.titre, notifData.message, notifData.type, notifData.priorite, `/fournisseur/commandes/${commandeId}`);
    }

    return res.status(201).json({ success: true, message: 'Commande créée avec succès', commandeId });
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (e) { /* ignore */ }
    }
    console.error('Erreur création commande:', error);
    return res.status(500).json({ success: false, message: 'Erreur lors de la création de la commande', details: error.message });
  } finally {
    if (client) client.release();
  }
});

/**
 * PUT /:id/statut - mise à jour du statut (fournisseur/livreur/admin)
 */
router.put('/:id/statut', authMiddleware, async (req, res) => {
  let client;
  try {
    client = await db.connect();
    const { id } = req.params;
    const { statut } = req.body;
    if (!statut) return res.status(400).json({ success: false, message: 'Statut requis' });

    await client.query('BEGIN');

    const commandeResult = await client.query(
      `SELECT c.*, 
              cl.utilisateur_id as client_user_id, 
              f.utilisateur_id as fournisseur_user_id,
              l.utilisateur_id as livreur_user_id
       FROM commandes c
       JOIN clients cl ON c.client_id = cl.id
       JOIN fournisseurs f ON c.fournisseur_id = f.id
       LEFT JOIN livreurs l ON c.livreur_id = l.id
       WHERE c.id = $1`,
      [id]
    );

    if (commandeResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Commande introuvable' });
    }

    const commande = commandeResult.rows[0];
    // Optionnel: vérifier l'autorisation de l'utilisateur en fonction de son rôle (pas implémenté ici)

    await client.query('UPDATE commandes SET statut = $1, updated_at = NOW() WHERE id = $2', [statut, id]);

    // historiser changement
    await client.query(
      `INSERT INTO historique_statuts_commandes (id, commande_id, ancien_statut, nouveau_statut, date_changement)
       VALUES ($1, $2, $3, $4, NOW())`,
      [uuidv4(), id, commande.statut, statut]
    );

    // Si la commande est livrée, mettre la date de livraison réelle
    if (statut === 'livree') {
      await client.query('UPDATE commandes SET date_livraison_reelle = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    }

    await client.query('COMMIT');

    // notifications hors transaction
    let notifData = null;
    let destinataireId = null;
    switch (statut) {
      case 'en_preparation':
        notifData = notificationTypes.COMMANDE_CONFIRMEE(id.substring(0, 8));
        destinataireId = commande.client_user_id;
        break;
      case 'pret_pour_livraison':
        // notification directe au client
        notifData = { titre: 'Commande prête', message: 'Votre commande est prête et attend un livreur.', type: 'commande', priorite: 'normale' };
        await createNotification(commande.client_user_id, notifData.titre, notifData.message, notifData.type, notifData.priorite);
        break;
      case 'en_livraison':
        notifData = notificationTypes.COMMANDE_EN_ROUTE();
        destinataireId = commande.client_user_id;
        break;
      case 'livree':
        notifData = notificationTypes.COMMANDE_LIVREE();
        destinataireId = commande.client_user_id;
        break;
    }

    if (notifData && destinataireId) {
      await createNotification(destinataireId, notifData.titre, notifData.message, notifData.type, notifData.priorite, `/commandes/${id}`);
    }

    return res.json({ success: true, message: 'Statut mis à jour avec succès' });
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (e) { /* ignore */ }
    }
    console.error('Erreur mise à jour statut:', error);
    return res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour', details: error.message });
  } finally {
    if (client) client.release();
  }
});

/**
 * PUT /:id/assigner-livreur - assigner livreur
 */
router.put('/:id/assigner-livreur', authMiddleware, async (req, res) => {
  let client;
  try {
    client = await db.connect();
    const { id } = req.params;
    const { livreur_id } = req.body;

    // Récupérer commande et livreur
    const result = await client.query(
      `SELECT c.*, cl.utilisateur_id as client_user_id
       FROM commandes c
       JOIN clients cl ON c.client_id = cl.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Commande introuvable' });

    const commande = result.rows[0];

    // Vérifier livreur existe et récupérer utilisateur
    const livreurRes = await client.query('SELECT id, utilisateur_id FROM livreurs WHERE id = $1', [livreur_id]);
    if (livreurRes.rowCount === 0) return res.status(404).json({ success: false, message: 'Livreur introuvable' });

    // Assigner le livreur
    await client.query('UPDATE commandes SET livreur_id = $1, updated_at = NOW() WHERE id = $2', [livreur_id, id]);

    // Notif au client
    const livreurUserRes = await client.query('SELECT nom_complet FROM utilisateurs WHERE id = $1', [livreurRes.rows[0].utilisateur_id]);
    const livreurNom = livreurUserRes.rowCount ? livreurUserRes.rows[0].nom_complet : 'Livreur';
    const notifClient = notificationTypes.LIVREUR_ASSIGNE(livreurNom);
    await createNotification(commande.client_user_id, notifClient.titre, notifClient.message, notifClient.type, notifClient.priorite);

    // Notif au livreur (récupération d'adresse)
    const adresseResult = await client.query('SELECT rue, ville FROM adresses WHERE id = $1', [commande.adresse_livraison_id]);
    const adresseTxt = adresseResult.rowCount ? `${adresseResult.rows[0].rue}, ${adresseResult.rows[0].ville}` : 'Adresse inconnue';
    const notifLivreur = notificationTypes.NOUVELLE_LIVRAISON(adresseTxt, commande.montant_total);
    await createNotification(livreurRes.rows[0].utilisateur_id, notifLivreur.titre, notifLivreur.message, notifLivreur.type, notifLivreur.priorite, `/livreur/commandes/${id}`);

    return res.json({ success: true, message: 'Livreur assigné avec succès' });
  } catch (error) {
    console.error('Erreur assignation livreur:', error);
    return res.status(500).json({ success: false, message: 'Erreur lors de l\'assignation', details: error.message });
  } finally {
    if (client) client.release();
  }
});

/**
 * PUT /:id/confirmer-paiement - confirmer paiement en espèces par livreur
 */
router.put('/:id/confirmer-paiement', authMiddleware, checkRole('livreur'), async (req, res) => {
  let client;
  try {
    client = await db.connect();
    const { id } = req.params;

    await client.query('BEGIN');

    const paiementResult = await client.query(
      `SELECT p.*, c.client_id, cl.utilisateur_id as client_user_id
       FROM paiements p
       JOIN commandes c ON p.commande_id = c.id
       JOIN clients cl ON c.client_id = cl.id
       WHERE p.commande_id = $1`,
      [id]
    );

    if (paiementResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Paiement introuvable' });
    }

    const paiement = paiementResult.rows[0];

    await client.query(
      `UPDATE paiements SET statut = 'effectue', date_effective = CURRENT_TIMESTAMP, confirme_par = $1 WHERE id = $2`,
      [req.user.user_id, paiement.id]
    );

    await client.query(
      `UPDATE commandes SET statut_paiement = 'confirme', montant_paye = montant_total, date_paiement = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');

    // Notification au client
    const notifData = notificationTypes.PAIEMENT_CONFIRME(paiement.montant);
    await createNotification(paiement.client_user_id, notifData.titre, notifData.message, notifData.type, notifData.priorite);

    return res.json({ success: true, message: 'Paiement confirmé avec succès' });
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (e) { /* ignore */ }
    }
    console.error('Erreur confirmation paiement:', error);
    return res.status(500).json({ success: false, message: 'Erreur lors de la confirmation', details: error.message });
  } finally {
    if (client) client.release();
  }
});

/**
 * GET / - lister commandes (avec filtre rôle)
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { role } = req.user;
    const statut = req.query.statut;
    let limit = parseInt(req.query.limit, 10) || 50;
    let offset = parseInt(req.query.offset, 10) || 0;
    if (limit < 1) limit = 1;
    if (limit > 500) limit = 500;
    if (offset < 0) offset = 0;

    let query = `
      SELECT c.*, 
             u_client.nom_complet as client_nom,
             u_fournisseur.nom_complet as fournisseur_nom,
             u_livreur.nom_complet as livreur_nom,
             a.rue, a.ville
      FROM commandes c
      JOIN clients cl ON c.client_id = cl.id
      JOIN utilisateurs u_client ON cl.utilisateur_id = u_client.id
      JOIN fournisseurs f ON c.fournisseur_id = f.id
      JOIN utilisateurs u_fournisseur ON f.utilisateur_id = u_fournisseur.id
      LEFT JOIN livreurs l ON c.livreur_id = l.id
      LEFT JOIN utilisateurs u_livreur ON l.utilisateur_id = u_livreur.id
      LEFT JOIN adresses a ON c.adresse_livraison_id = a.id
      WHERE 1=1
    `;
    const params = [];

    if (role === 'client') {
      params.push(req.user.user_id);
      query += ` AND cl.utilisateur_id = $${params.length}`;
    } else if (role === 'fournisseur') {
      params.push(req.user.user_id);
      query += ` AND f.utilisateur_id = $${params.length}`;
    } else if (role === 'livreur') {
      params.push(req.user.user_id);
      query += ` AND l.utilisateur_id = $${params.length}`;
    }

    if (statut) {
      params.push(statut);
      query += ` AND c.statut = $${params.length}`;
    }

    params.push(limit, offset);
    query += ` ORDER BY c.date_commande DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await db.query(query, params);

    return res.json({ success: true, commandes: result.rows });
  } catch (error) {
    console.error('Erreur récupération commandes:', error);
    return res.status(500).json({ success: false, message: 'Erreur lors de la récupération', details: error.message });
  }
});

module.exports = router;
