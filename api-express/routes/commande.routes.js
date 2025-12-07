// backend/routes/commande.routes.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authMiddleware, checkRole } = require('../middleware/auth.middleware');
const { createNotification, notificationTypes } = require('./notification.routes');

// Créer une commande (Client)
router.post('/', authMiddleware, checkRole('client'), async (req, res) => {
  const client = await db.getClient();
  
  try {
    const {
      fournisseur_id,
      adresse_livraison_id,
      produits, // [{produit_id, quantite, options_selectionnees}]
      instructions_speciales,
      mode_paiement
    } = req.body;

    await client.query('BEGIN');

    // Récupérer l'ID client
    const clientResult = await client.query(
      'SELECT id FROM clients WHERE utilisateur_id = $1',
      [req.user.user_id]
    );
    const clientId = clientResult.rows[0].id;

    // Calculer le montant total
    let montantTotal = 0;
    for (const prod of produits) {
      const prodResult = await client.query(
        'SELECT prix FROM produits WHERE id = $1',
        [prod.produit_id]
      );
      montantTotal += prodResult.rows[0].prix * prod.quantite;
    }

    // Récupérer les frais de livraison
    const fraisResult = await client.query(
      'SELECT frais_livraison FROM fournisseurs WHERE id = $1',
      [fournisseur_id]
    );
    const fraisLivraison = fraisResult.rows[0].frais_livraison;
    const fraisService = montantTotal * 0.05; // 5% de frais de service

    const commandeId = uuidv4();
    
    // Créer la commande
    await client.query(
      `INSERT INTO commandes 
       (id, client_id, fournisseur_id, adresse_livraison_id, 
        montant_total, frais_service, frais_livraison, 
        instructions_speciales, mode_paiement, statut)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'en_attente')`,
      [commandeId, clientId, fournisseur_id, adresse_livraison_id,
       montantTotal + fraisLivraison + fraisService, fraisService, fraisLivraison,
       instructions_speciales, mode_paiement]
    );

    // Créer les lignes de commande
    for (const prod of produits) {
      const prodResult = await client.query(
        'SELECT prix FROM produits WHERE id = $1',
        [prod.produit_id]
      );
      
      await client.query(
        `INSERT INTO lignes_commande 
         (id, commande_id, produit_id, quantite, prix_unitaire, options_selectionnees)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [uuidv4(), commandeId, prod.produit_id, prod.quantite, 
         prodResult.rows[0].prix, JSON.stringify(prod.options_selectionnees || {})]
      );
    }

    // Créer le paiement
    const paiementId = uuidv4();
    await client.query(
      `INSERT INTO paiements 
       (id, commande_id, montant, mode_paiement, statut)
       VALUES ($1, $2, $3, $4, 'en_attente')`,
      [paiementId, commandeId, montantTotal + fraisLivraison + fraisService, mode_paiement]
    );

    // Récupérer le fournisseur pour notification
    const fournisseurResult = await client.query(
      'SELECT utilisateur_id FROM fournisseurs WHERE id = $1',
      [fournisseur_id]
    );

    await client.query('COMMIT');

    // Envoyer notification au fournisseur
    const notifData = notificationTypes.NOUVELLE_COMMANDE(
      commandeId.substring(0, 8), 
      (montantTotal + fraisLivraison + fraisService).toFixed(2)
    );
    await createNotification(
      fournisseurResult.rows[0].utilisateur_id,
      notifData.titre,
      notifData.message,
      notifData.type,
      notifData.priorite,
      `/fournisseur/commandes/${commandeId}`
    );

    res.status(201).json({
      success: true,
      message: 'Commande créée avec succès',
      commandeId
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur création commande:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la commande'
    });
  } finally {
    client.release();
  }
});

// Mettre à jour le statut (Fournisseur/Livreur)
router.put('/:id/statut', authMiddleware, async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { id } = req.params;
    const { statut } = req.body;

    await client.query('BEGIN');

    // Récupérer la commande
    const commandeResult = await client.query(
      `SELECT c.*, cl.utilisateur_id as client_user_id, 
              f.utilisateur_id as fournisseur_user_id,
              l.utilisateur_id as livreur_user_id
       FROM commandes c
       JOIN clients cl ON c.client_id = cl.id
       JOIN fournisseurs f ON c.fournisseur_id = f.id
       LEFT JOIN livreurs l ON c.livreur_id = l.id
       WHERE c.id = $1`,
      [id]
    );

    if (commandeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Commande introuvable'
      });
    }

    const commande = commandeResult.rows[0];

    // Mettre à jour le statut
    await client.query(
      'UPDATE commandes SET statut = $1 WHERE id = $2',
      [statut, id]
    );

    await client.query('COMMIT');

    // Envoyer les notifications selon le statut
    let notifData;
    let destinataireId;

    switch(statut) {
      case 'en_preparation':
        notifData = notificationTypes.COMMANDE_CONFIRMEE(id.substring(0, 8));
        destinataireId = commande.client_user_id;
        break;

      case 'pret_pour_livraison':
        // Notif au client
        notifData = { 
          titre: 'Commande prête', 
          message: 'Votre commande est prête et attend un livreur.',
          type: 'commande',
          priorite: 'normale'
        };
        await createNotification(
          commande.client_user_id,
          notifData.titre,
          notifData.message,
          notifData.type,
          notifData.priorite
        );
        break;

      case 'en_livraison':
        // Notif au client
        notifData = notificationTypes.COMMANDE_EN_ROUTE();
        destinataireId = commande.client_user_id;
        break;

      case 'livree':
        // Notif au client
        notifData = notificationTypes.COMMANDE_LIVREE();
        destinataireId = commande.client_user_id;
        
        // Mettre à jour date_livraison_reelle
        await db.query(
          'UPDATE commandes SET date_livraison_reelle = CURRENT_TIMESTAMP WHERE id = $1',
          [id]
        );
        break;
    }

    if (notifData && destinataireId) {
      await createNotification(
        destinataireId,
        notifData.titre,
        notifData.message,
        notifData.type,
        notifData.priorite,
        `/commandes/${id}`
      );
    }

    res.json({
      success: true,
      message: 'Statut mis à jour avec succès'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur mise à jour statut:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour'
    });
  } finally {
    client.release();
  }
});

// Assigner un livreur (Système automatique ou manuel)
router.put('/:id/assigner-livreur', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { livreur_id } = req.body;

    // Récupérer les infos
    const result = await db.query(
      `SELECT c.*, cl.utilisateur_id as client_user_id,
              l.utilisateur_id as livreur_user_id, u.nom_complet
       FROM commandes c
       JOIN clients cl ON c.client_id = cl.id
       JOIN livreurs l ON l.id = $2
       JOIN utilisateurs u ON l.utilisateur_id = u.id
       WHERE c.id = $1`,
      [id, livreur_id]
    );

    const commande = result.rows[0];

    // Assigner le livreur
    await db.query(
      'UPDATE commandes SET livreur_id = $1 WHERE id = $2',
      [livreur_id, id]
    );

    // Notif au client
    const notifClient = notificationTypes.LIVREUR_ASSIGNE(commande.nom_complet);
    await createNotification(
      commande.client_user_id,
      notifClient.titre,
      notifClient.message,
      notifClient.type,
      notifClient.priorite
    );

    // Notif au livreur
    const adresseResult = await db.query(
      'SELECT ville, rue FROM adresses WHERE id = $1',
      [commande.adresse_livraison_id]
    );
    
    const notifLivreur = notificationTypes.NOUVELLE_LIVRAISON(
      `${adresseResult.rows[0].rue}, ${adresseResult.rows[0].ville}`,
      commande.montant_total
    );
    await createNotification(
      commande.livreur_user_id,
      notifLivreur.titre,
      notifLivreur.message,
      notifLivreur.type,
      notifLivreur.priorite,
      `/livreur/commandes/${id}`
    );

    res.json({
      success: true,
      message: 'Livreur assigné avec succès'
    });

  } catch (error) {
    console.error('Erreur assignation livreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'assignation'
    });
  }
});

// Confirmer le paiement (Livreur pour espèces)
router.put('/:id/confirmer-paiement', authMiddleware, checkRole('livreur'), async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Récupérer le paiement
    const paiementResult = await client.query(
      `SELECT p.*, c.client_id, cl.utilisateur_id as client_user_id
       FROM paiements p
       JOIN commandes c ON p.commande_id = c.id
       JOIN clients cl ON c.client_id = cl.id
       WHERE p.commande_id = $1`,
      [id]
    );

    if (paiementResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Paiement introuvable'
      });
    }

    const paiement = paiementResult.rows[0];

    // Mettre à jour le paiement
    await client.query(
      `UPDATE paiements 
       SET statut = 'effectue', 
           date_effective = CURRENT_TIMESTAMP,
           confirme_par = $1
       WHERE id = $2`,
      [req.user.user_id, paiement.id]
    );

    // Mettre à jour la commande
    await client.query(
      `UPDATE commandes 
       SET statut_paiement = 'confirme', 
           montant_paye = montant_total,
           date_paiement = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');

    // Notification au client
    const notifData = notificationTypes.PAIEMENT_CONFIRME(paiement.montant);
    await createNotification(
      paiement.client_user_id,
      notifData.titre,
      notifData.message,
      notifData.type,
      notifData.priorite
    );

    res.json({
      success: true,
      message: 'Paiement confirmé avec succès'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur confirmation paiement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la confirmation'
    });
  } finally {
    client.release();
  }
});

// Récupérer les commandes
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { role } = req.user;
    const { statut, limit = 50, offset = 0 } = req.query;

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
      JOIN adresses a ON c.adresse_livraison_id = a.id
      WHERE 1=1
    `;

    const params = [];

    if (role === 'client') {
      query += ` AND cl.utilisateur_id = $${params.length + 1}`;
      params.push(req.user.user_id);
    } else if (role === 'fournisseur') {
      query += ` AND f.utilisateur_id = $${params.length + 1}`;
      params.push(req.user.user_id);
    } else if (role === 'livreur') {
      query += ` AND l.utilisateur_id = $${params.length + 1}`;
      params.push(req.user.user_id);
    }

    if (statut) {
      query += ` AND c.statut = $${params.length + 1}`;
      params.push(statut);
    }

    query += ` ORDER BY c.date_commande DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      success: true,
      commandes: result.rows
    });

  } catch (error) {
    console.error('Erreur récupération commandes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération'
    });
  }
});

module.exports = router;