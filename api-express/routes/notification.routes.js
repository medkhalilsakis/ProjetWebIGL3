// backend/routes/notification.routes.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');

/**
 * createNotification(utilisateurId, titre, message, type, priorite = 'normale', lienAction = null)
 * Insert une notification et retourne la ligne insérée.
 */
const createNotification = async (utilisateurId, titre, message, type, priorite = 'normale', lienAction = null) => {
  try {
    const notifId = uuidv4();
    const res = await db.query(
      `INSERT INTO notifications 
       (id, utilisateur_id, titre, message, type, priorite, lien_action, lu, date_creation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false, CURRENT_TIMESTAMP)
       RETURNING *`,
      [notifId, utilisateurId, titre, message, type, priorite, lienAction]
    );
    return res.rows[0];
  } catch (error) {
    console.error('Erreur création notification:', error);
    throw error;
  }
};

// Récupérer notifications
router.get('/', authMiddleware, async (req, res) => {
  try {
    let limit = parseInt(req.query.limit, 10) || 20;
    let offset = parseInt(req.query.offset, 10) || 0;
    const lu = req.query.lu;

    if (limit < 1) limit = 1;
    if (limit > 200) limit = 200;
    if (offset < 0) offset = 0;

    const params = [req.user.user_id];
    let query = `SELECT * FROM notifications WHERE utilisateur_id = $1`;

    if (typeof lu !== 'undefined') {
      const luBool = (lu === 'true' || lu === true);
      params.push(luBool);
      query += ` AND lu = $${params.length}`;
    }

    params.push(limit, offset);
    query += ` ORDER BY date_creation DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await db.query(query, params);

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM notifications WHERE utilisateur_id = $1 AND lu = false',
      [req.user.user_id]
    );

    res.json({
      success: true,
      notifications: result.rows,
      unread_count: parseInt(countResult.rows[0].total, 10) || 0
    });
  } catch (error) {
    console.error('Erreur récupération notifications:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des notifications' });
  }
});

// Marquer comme lu
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `UPDATE notifications SET lu = true, date_lecture = CURRENT_TIMESTAMP 
       WHERE id = $1 AND utilisateur_id = $2 RETURNING id`,
      [id, req.user.user_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Notification introuvable' });
    }

    res.json({ success: true, message: 'Notification marquée comme lue' });
  } catch (error) {
    console.error('Erreur marquage notification:', error);
    res.status(500).json({ success: false, message: 'Erreur lors du marquage' });
  }
});

// Marquer toutes comme lues
router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE notifications SET lu = true, date_lecture = CURRENT_TIMESTAMP 
       WHERE utilisateur_id = $1 AND lu = false RETURNING id`,
      [req.user.user_id]
    );

    res.json({ success: true, message: 'Toutes les notifications marquées comme lues', updated: result.rowCount });
  } catch (error) {
    console.error('Erreur marquage notifications:', error);
    res.status(500).json({ success: false, message: 'Erreur lors du marquage' });
  }
});

// Supprimer une notification
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM notifications WHERE id = $1 AND utilisateur_id = $2 RETURNING id', [id, req.user.user_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Notification introuvable' });
    }

    res.json({ success: true, message: 'Notification supprimée' });
  } catch (error) {
    console.error('Erreur suppression notification:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression' });
  }
});

// Types de notification (inchangés, fournis pour usage centralisé)
const notificationTypes = {
  COMMANDE_CONFIRMEE: (commandeId) => ({ titre: 'Commande confirmée', message: `Votre commande #${commandeId} a été confirmée et est en préparation.`, type: 'commande', priorite: 'normale' }),
  LIVREUR_ASSIGNE: (livreurNom) => ({ titre: 'Livreur assigné', message: `${livreurNom} a été assigné à votre commande et arrive bientôt.`, type: 'commande', priorite: 'haute' }),
  COMMANDE_EN_ROUTE: () => ({ titre: 'Commande en route', message: 'Votre commande est en cours de livraison !', type: 'commande', priorite: 'haute' }),
  COMMANDE_LIVREE: () => ({ titre: 'Commande livrée', message: 'Votre commande a été livrée. Bon appétit !', type: 'commande', priorite: 'normale' }),
  NOUVELLE_COMMANDE: (commandeId, montant) => ({ titre: 'Nouvelle commande', message: `Nouvelle commande #${commandeId} d'un montant de ${montant} DH.`, type: 'commande', priorite: 'urgente' }),
  COMMANDE_ANNULEE_CLIENT: (commandeId) => ({ titre: 'Commande annulée', message: `La commande #${commandeId} a été annulée par le client.`, type: 'annulation', priorite: 'haute' }),
  NOUVELLE_LIVRAISON: (adresse, montant) => ({ titre: 'Nouvelle livraison disponible', message: `Livraison vers ${adresse} - ${montant} DH`, type: 'commande', priorite: 'urgente' }),
  COMMANDE_PRETE: (fournisseurNom) => ({ titre: 'Commande prête', message: `La commande chez ${fournisseurNom} est prête pour le retrait.`, type: 'commande', priorite: 'haute' }),
  PAIEMENT_CONFIRME: (montant) => ({ titre: 'Paiement confirmé', message: `Paiement de ${montant} DH confirmé avec succès.`, type: 'paiement', priorite: 'normale' }),
  PAIEMENT_ECHOUE: () => ({ titre: 'Paiement échoué', message: 'Le paiement a échoué. Veuillez réessayer.', type: 'paiement', priorite: 'haute' })
};

module.exports = { router, createNotification, notificationTypes };
