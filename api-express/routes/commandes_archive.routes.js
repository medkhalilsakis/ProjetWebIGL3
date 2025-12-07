// routes/commandes_archive.routes.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authMiddleware, checkRole } = require('../middleware/auth.middleware');

// GET archived orders (admin only)
router.get('/', authMiddleware, checkRole('admin'), async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await db.query(
      `SELECT c.*, f.nom_entreprise FROM commandes_archive c
       LEFT JOIN fournisseurs f ON c.fournisseur_id = f.id
       ORDER BY c.date_archivage DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return res.json({
      success: true,
      data: result.rows.map(order => ({
        id: order.id,
        numero_suivi: `ORD-${order.id.substring(0, 8).toUpperCase()}`,
        montant_total: order.montant_total,
        statut: order.statut,
        fournisseur: order.nom_entreprise,
        date_archivage: order.date_archivage
      }))
    });
  } catch (error) {
    console.error('Error fetching archived orders:', error);
    return res.status(500).json({ success: false, message: 'Error fetching archived orders' });
  }
});

// GET archived order details
router.get('/:id', authMiddleware, checkRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT * FROM commandes_archive WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Archived order not found' });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching archived order:', error);
    return res.status(500).json({ success: false, message: 'Error fetching order' });
  }
});

module.exports = router;
