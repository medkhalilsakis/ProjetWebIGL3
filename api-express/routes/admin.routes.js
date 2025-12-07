// routes/admin.routes.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authMiddleware, checkRole } = require('../middleware/auth.middleware');

// GET all users
router.get('/utilisateurs', authMiddleware, checkRole('admin'), async (req, res) => {
  try {
    const { role, statut, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT id, email, nom_complet, role, statut, date_creation FROM utilisateurs';
    const params = [];
    let paramCount = 1;

    if (role) {
      query += ` WHERE role = $${paramCount++}`;
      params.push(role);
    }

    if (statut) {
      query += (role ? ' AND' : ' WHERE') + ` statut = $${paramCount++}`;
      params.push(statut);
    }

    query += ` ORDER BY date_creation DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ success: false, message: 'Error fetching users' });
  }
});

// GET dashboard statistics
router.get('/statistiques', authMiddleware, checkRole('admin'), async (req, res) => {
  try {
    const stats = await Promise.all([
      db.query('SELECT COUNT(*) as count FROM utilisateurs'),
      db.query('SELECT COUNT(*) as count FROM commandes WHERE DATE(date_commande) = CURRENT_DATE'),
      db.query('SELECT SUM(montant_total) as total FROM commandes WHERE DATE(date_commande) = CURRENT_DATE'),
      db.query('SELECT COUNT(*) as count FROM utilisateurs WHERE role = \'fournisseur\''),
      db.query('SELECT COUNT(*) as count FROM utilisateurs WHERE role = \'livreur\''),
      db.query('SELECT COUNT(*) as count FROM commandes WHERE statut = \'livree\'')
    ]);

    return res.json({
      success: true,
      data: {
        totalUsers: stats[0].rows[0].count,
        ordersToday: stats[1].rows[0].count,
        revenueToday: stats[2].rows[0].total || 0,
        totalSuppliers: stats[3].rows[0].count,
        totalDeliverers: stats[4].rows[0].count,
        completedOrders: stats[5].rows[0].count
      }
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    return res.status(500).json({ success: false, message: 'Error fetching statistics' });
  }
});

// PATCH user status
router.patch('/utilisateurs/:id/statut', authMiddleware, checkRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { statut } = req.body;

    await db.query(
      'UPDATE utilisateurs SET statut = $1, updated_at = now() WHERE id = $2',
      [statut, id]
    );

    return res.json({ success: true, message: 'User status updated' });
  } catch (error) {
    console.error('Error updating user status:', error);
    return res.status(500).json({ success: false, message: 'Error updating status' });
  }
});

// DELETE user
router.delete('/utilisateurs/:id', authMiddleware, checkRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    await db.query('DELETE FROM utilisateurs WHERE id = $1', [id]);

    return res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ success: false, message: 'Error deleting user' });
  }
});

// GET all orders
router.get('/commandes', authMiddleware, checkRole('admin'), async (req, res) => {
  try {
    const { statut, limit = 50, offset = 0 } = req.query;

    let query = `SELECT c.*, f.nom_entreprise, cl.id as client_id
                 FROM commandes c
                 LEFT JOIN fournisseurs f ON c.fournisseur_id = f.id
                 LEFT JOIN clients cl ON c.client_id = cl.id`;
    const params = [];
    let paramCount = 1;

    if (statut) {
      query += ` WHERE c.statut = $${paramCount++}`;
      params.push(statut);
    }

    query += ` ORDER BY c.date_commande DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    return res.json({
      success: true,
      data: result.rows.map(order => ({
        id: order.id,
        numero_suivi: `ORD-${order.id.substring(0, 8).toUpperCase()}`,
        montant_total: order.montant_total,
        statut: order.statut,
        fournisseur: order.nom_entreprise,
        date_commande: order.date_commande
      }))
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return res.status(500).json({ success: false, message: 'Error fetching orders' });
  }
});

// GET order details
router.get('/commandes/:id', authMiddleware, checkRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT c.*, f.nom_entreprise, u.nom_complet as client_nom
       FROM commandes c
       LEFT JOIN fournisseurs f ON c.fournisseur_id = f.id
       LEFT JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN utilisateurs u ON cl.utilisateur_id = u.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = result.rows[0];
    const items = await db.query(
      'SELECT * FROM lignes_commande WHERE commande_id = $1',
      [id]
    );

    return res.json({
      success: true,
      data: {
        ...order,
        items: items.rows
      }
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    return res.status(500).json({ success: false, message: 'Error fetching order' });
  }
});

module.exports = router;
