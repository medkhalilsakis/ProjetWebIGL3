// routes/historique_statuts_commandes.routes.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');

// GET order status history
router.get('/commande/:commande_id', authMiddleware, async (req, res) => {
  try {
    const { commande_id } = req.params;

    const result = await db.query(
      `SELECT ancien_statut, nouveau_statut, date_changement 
       FROM historique_statuts_commandes
       WHERE commande_id = $1
       ORDER BY date_changement ASC`,
      [commande_id]
    );

    return res.json({
      success: true,
      data: result.rows.map(history => ({
        from: history.ancien_statut,
        to: history.nouveau_statut,
        date: history.date_changement
      }))
    });
  } catch (error) {
    console.error('Error fetching order status history:', error);
    return res.status(500).json({ success: false, message: 'Error fetching history' });
  }
});

module.exports = router;
