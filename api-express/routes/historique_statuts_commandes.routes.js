// routes/historique_statuts_commandes.routes.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');

router.get('/commande/:commande_id', authMiddleware, async (req, res) => {
  try {
    const { commande_id } = req.params;
    // Vérifier que l'utilisateur a le droit de voir l'historique (client, fournisseur, livreur ou admin)
    const accessCheck = await db.query(
      `SELECT c.id
       FROM commandes c
       LEFT JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN fournisseurs f ON c.fournisseur_id = f.id
       LEFT JOIN livreurs l ON c.livreur_id = l.id
       WHERE c.id = $1
         AND (
           cl.utilisateur_id = $2 OR
           f.utilisateur_id = $2 OR
           l.utilisateur_id = $2 OR
           EXISTS (SELECT 1 FROM admins a WHERE a.utilisateur_id = $2)
         )`,
      [commande_id, req.user.user_id]
    );

    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    const result = await db.query(
      `SELECT ancien_statut, nouveau_statut, date_changement 
       FROM historique_statuts_commandes
       WHERE commande_id = $1
       ORDER BY date_changement ASC`,
      [commande_id]
    );

    return res.json({
      success: true,
      data: result.rows.map(history => ({ from: history.ancien_statut, to: history.nouveau_statut, date: history.date_changement }))
    });
  } catch (error) {
    console.error('Error fetching order status history:', error);
    return res.status(500).json({ success: false, message: 'Error fetching history' });
  }
});

module.exports = router;
