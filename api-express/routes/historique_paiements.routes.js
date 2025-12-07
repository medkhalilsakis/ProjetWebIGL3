// routes/historique_paiements.routes.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');

// GET payment history for user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.* FROM paiements p
       JOIN commandes c ON p.commande_id = c.id
       JOIN clients cl ON c.client_id = cl.id
       WHERE cl.utilisateur_id = $1
       ORDER BY p.created_at DESC
       LIMIT 100`,
      [req.user.user_id]
    );

    return res.json({
      success: true,
      data: result.rows.map(payment => ({
        id: payment.id,
        montant: payment.montant,
        mode_paiement: payment.mode_paiement,
        statut: payment.statut,
        date: payment.created_at,
        commande_id: payment.commande_id
      }))
    });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    return res.status(500).json({ success: false, message: 'Error fetching history' });
  }
});

// GET payment history for supplier
router.get('/fournisseur', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*, c.montant_total FROM paiements p
       JOIN commandes c ON p.commande_id = c.id
       WHERE c.fournisseur_id = (SELECT id FROM fournisseurs WHERE utilisateur_id = $1)
       ORDER BY p.created_at DESC
       LIMIT 100`,
      [req.user.user_id]
    );

    return res.json({
      success: true,
      data: result.rows.map(payment => ({
        id: payment.id,
        montant: payment.montant,
        mode_paiement: payment.mode_paiement,
        statut: payment.statut,
        date: payment.created_at,
        commande_id: payment.commande_id
      }))
    });
  } catch (error) {
    console.error('Error fetching supplier payment history:', error);
    return res.status(500).json({ success: false, message: 'Error fetching history' });
  }
});

module.exports = router;
