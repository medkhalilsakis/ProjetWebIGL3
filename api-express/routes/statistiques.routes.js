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
      db.query('SELECT COALESCE(SUM(montant_total),0) as total FROM commandes'),
      db.query('SELECT COALESCE(AVG(montant_total),0) as moyenne FROM commandes'),
      db.query('SELECT COUNT(*) as count FROM produits'),
      db.query('SELECT COUNT(*) as count FROM commandes WHERE DATE(date_commande) = CURRENT_DATE')
    ]);

    return res.json({
      success: true,
      data: {
        totalUsers: parseInt(stats[0].rows[0].count, 10) || 0,
        totalOrders: parseInt(stats[1].rows[0].count, 10) || 0,
        totalRevenue: parseFloat(stats[2].rows[0].total) || 0,
        averageOrderValue: parseFloat(stats[3].rows[0].moyenne) || 0,
        totalProducts: parseInt(stats[4].rows[0].count, 10) || 0,
        ordersToday: parseInt(stats[5].rows[0].count, 10) || 0
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
    const fournisseurResult = await db.query('SELECT id FROM fournisseurs WHERE utilisateur_id = $1 LIMIT 1', [req.user.user_id]);

    if (fournisseurResult.rows.length === 0) {
      return res.json({ success: true, data: {} });
    }

    const fournisseurId = fournisseurResult.rows[0].id;

    const stats = await Promise.all([
      db.query('SELECT COUNT(*) as count FROM commandes WHERE fournisseur_id = $1', [fournisseurId]),
      db.query('SELECT COALESCE(SUM(montant_total),0) as total FROM commandes WHERE fournisseur_id = $1', [fournisseurId]),
      db.query('SELECT COUNT(*) as count FROM produits WHERE fournisseur_id = $1', [fournisseurId]),
      db.query('SELECT COUNT(*) as count FROM commandes WHERE fournisseur_id = $1 AND DATE(date_commande) = CURRENT_DATE', [fournisseurId]),
      db.query('SELECT COALESCE(SUM(montant_total),0) as total FROM commandes WHERE fournisseur_id = $1 AND DATE(date_commande) = CURRENT_DATE', [fournisseurId])
    ]);

    return res.json({
      success: true,
      data: {
        totalOrders: parseInt(stats[0].rows[0].count, 10) || 0,
        totalRevenue: parseFloat(stats[1].rows[0].total) || 0,
        totalProducts: parseInt(stats[2].rows[0].count, 10) || 0,
        ordersToday: parseInt(stats[3].rows[0].count, 10) || 0,
        revenueToday: parseFloat(stats[4].rows[0].total) || 0
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
    const result = await db.query('SELECT statut, COUNT(*) as count FROM commandes GROUP BY statut');
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching order statistics:', error);
    return res.status(500).json({ success: false, message: 'Error fetching statistics' });
  }
});

// GET revenue by date (paramétré)
router.get('/revenue/dates', authMiddleware, checkRole('admin'), async (req, res) => {
  try {
    const days = Math.max(1, parseInt(req.query.days || '30', 10));
    const result = await db.query(
      `SELECT DATE(date_commande) as date, COALESCE(SUM(montant_total),0) as revenue, COUNT(*) as orders
       FROM commandes
       WHERE date_commande >= (NOW() - ($1::int * INTERVAL '1 day'))
       GROUP BY DATE(date_commande)
       ORDER BY date DESC`,
      [days]
    );

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching revenue statistics:', error);
    return res.status(500).json({ success: false, message: 'Error fetching statistics' });
  }
});

module.exports = router;
