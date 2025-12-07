// routes/statistiques.routes.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authMiddleware, checkRole } = require('../middleware/auth.middleware');

// GET global statistics (admin)
router.get('/global', authMiddleware, checkRole('admin'), async (req, res) => {
  try {
    const stats = await Promise.all([
      db.query('SELECT COUNT(*) as count FROM utilisateurs'),
      db.query('SELECT COUNT(*) as count FROM commandes'),
      db.query('SELECT SUM(montant_total) as total FROM commandes'),
      db.query('SELECT AVG(montant_total) as moyenne FROM commandes'),
      db.query('SELECT COUNT(*) as count FROM produits'),
      db.query('SELECT COUNT(*) as count FROM commandes WHERE DATE(date_commande) = CURRENT_DATE')
    ]);

    return res.json({
      success: true,
      data: {
        totalUsers: stats[0].rows[0].count,
        totalOrders: stats[1].rows[0].count,
        totalRevenue: stats[2].rows[0].total || 0,
        averageOrderValue: stats[3].rows[0].moyenne || 0,
        totalProducts: stats[4].rows[0].count,
        ordersToday: stats[5].rows[0].count
      }
    });
  } catch (error) {
    console.error('Error fetching global statistics:', error);
    return res.status(500).json({ success: false, message: 'Error fetching statistics' });
  }
});

// GET supplier statistics
router.get('/fournisseur', authMiddleware, checkRole('fournisseur'), async (req, res) => {
  try {
    const fournisseurResult = await db.query(
      'SELECT id FROM fournisseurs WHERE utilisateur_id = $1',
      [req.user.user_id]
    );

    if (fournisseurResult.rows.length === 0) {
      return res.json({ success: true, data: {} });
    }

    const fournisseurId = fournisseurResult.rows[0].id;

    const stats = await Promise.all([
      db.query('SELECT COUNT(*) as count FROM commandes WHERE fournisseur_id = $1', [fournisseurId]),
      db.query('SELECT SUM(montant_total) as total FROM commandes WHERE fournisseur_id = $1', [fournisseurId]),
      db.query('SELECT COUNT(*) as count FROM produits WHERE fournisseur_id = $1', [fournisseurId]),
      db.query('SELECT COUNT(*) as count FROM commandes WHERE fournisseur_id = $1 AND DATE(date_commande) = CURRENT_DATE', [fournisseurId]),
      db.query('SELECT SUM(montant_total) as total FROM commandes WHERE fournisseur_id = $1 AND DATE(date_commande) = CURRENT_DATE', [fournisseurId])
    ]);

    return res.json({
      success: true,
      data: {
        totalOrders: stats[0].rows[0].count,
        totalRevenue: stats[1].rows[0].total || 0,
        totalProducts: stats[2].rows[0].count,
        ordersToday: stats[3].rows[0].count,
        revenueToday: stats[4].rows[0].total || 0
      }
    });
  } catch (error) {
    console.error('Error fetching supplier statistics:', error);
    return res.status(500).json({ success: false, message: 'Error fetching statistics' });
  }
});

// GET orders by status
router.get('/commandes/statut', authMiddleware, checkRole('admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT statut, COUNT(*) as count FROM commandes GROUP BY statut`
    );

    return res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching order statistics:', error);
    return res.status(500).json({ success: false, message: 'Error fetching statistics' });
  }
});

// GET revenue by date
router.get('/revenue/dates', authMiddleware, checkRole('admin'), async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const result = await db.query(
      `SELECT DATE(date_commande) as date, SUM(montant_total) as revenue, COUNT(*) as orders
       FROM commandes
       WHERE date_commande >= NOW() - INTERVAL '${parseInt(days)} days'
       GROUP BY DATE(date_commande)
       ORDER BY date DESC`
    );

    return res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching revenue statistics:', error);
    return res.status(500).json({ success: false, message: 'Error fetching statistics' });
  }
});

module.exports = router;
