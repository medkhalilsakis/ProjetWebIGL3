// routes/admin.routes.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authMiddleware, checkRole } = require('../middleware/auth.middleware');

// util
function parseLimitOffset(qLimit, qOffset, defaultLimit = 50) {
  let limit = parseInt(qLimit, 10) || defaultLimit;
  let offset = parseInt(qOffset, 10) || 0;
  if (limit < 1) limit = 1;
  if (limit > 1000) limit = 1000;
  if (offset < 0) offset = 0;
  return { limit, offset };
}

// GET all users
router.get('/utilisateurs', authMiddleware, checkRole('admin'), async (req, res) => {
  try {
    const { role, statut } = req.query;
    const { limit, offset } = parseLimitOffset(req.query.limit, req.query.offset, 50);

    const where = [];
    const params = [];

    if (role) { params.push(role); where.push(`u.role = $${params.length}`); }
    if (statut) { params.push(statut); where.push(`u.statut = $${params.length}`); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Query avec jointures pour obtenir les détails selon le rôle
    let sql = `SELECT u.id, u.email, u.nom_complet, u.telephone, u.role, u.statut, u.date_creation,
                      u.photo_profil`;
    
    if (role === 'livreur' || !role) {
      sql += `, l.type_vehicule, l.numero_permis, l.note_moyenne, l.nombre_livraisons,
                     l.vehicule_enregistre, l.assurance_valide`;
    }
    
    if (role === 'fournisseur' || !role) {
      sql += `, f.nom_entreprise, f.type_fournisseur`;
    }

    sql += ` FROM utilisateurs u
             LEFT JOIN livreurs l ON u.id = l.utilisateur_id
             LEFT JOIN fournisseurs f ON u.id = f.utilisateur_id
             ${whereClause}
             ORDER BY u.date_creation DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    params.push(limit, offset);

    const result = await db.query(sql, params);

    // Formater les résultats
    const formatted = result.rows.map(row => ({
      id: row.id,
      email: row.email,
      nom_complet: row.nom_complet,
      telephone: row.telephone,
      role: row.role,
      statut: row.statut,
      date_creation: row.date_creation,
      photo_profil: row.photo_profil,
      ...(row.role === 'livreur' && {
        type_vehicule: row.type_vehicule,
        numero_permis: row.numero_permis,
        note_moyenne: row.note_moyenne ? parseFloat(row.note_moyenne) : null,
        nombre_livraisons: row.nombre_livraisons || 0,
        vehicule_enregistre: row.vehicule_enregistre,
        assurance_valide: row.assurance_valide,
        verifie: row.vehicule_enregistre && row.assurance_valide && row.numero_permis
      }),
      ...(row.role === 'fournisseur' && {
        nom_entreprise: row.nom_entreprise,
        type_fournisseur: row.type_fournisseur
      })
    }));

    return res.json({ success: true, data: formatted });
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
      db.query('SELECT COALESCE(SUM(montant_total),0) as total FROM commandes WHERE DATE(date_commande) = CURRENT_DATE'),
      db.query("SELECT COUNT(*) as count FROM utilisateurs WHERE role = 'fournisseur'"),
      db.query("SELECT COUNT(*) as count FROM utilisateurs WHERE role = 'livreur'"),
      db.query("SELECT COUNT(*) as count FROM commandes WHERE statut = 'livree'")
    ]);

    return res.json({
      success: true,
      data: {
        totalUsers: parseInt(stats[0].rows[0].count, 10) || 0,
        ordersToday: parseInt(stats[1].rows[0].count, 10) || 0,
        revenueToday: parseFloat(stats[2].rows[0].total) || 0,
        totalSuppliers: parseInt(stats[3].rows[0].count, 10) || 0,
        totalDeliverers: parseInt(stats[4].rows[0].count, 10) || 0,
        completedOrders: parseInt(stats[5].rows[0].count, 10) || 0
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
    if (!statut) return res.status(400).json({ success: false, message: 'Statut requis' });

    const result = await db.query(
      'UPDATE utilisateurs SET statut = $1, updated_at = now() WHERE id = $2 RETURNING id',
      [statut, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });

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
    const result = await db.query('DELETE FROM utilisateurs WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });

    return res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ success: false, message: 'Error deleting user' });
  }
});

// GET all orders
router.get('/commandes', authMiddleware, checkRole('admin'), async (req, res) => {
  try {
    const { statut } = req.query;
    const { limit, offset } = parseLimitOffset(req.query.limit, req.query.offset, 50);

    const params = [];
    const where = [];

    if (statut) { params.push(statut); where.push(`c.statut = $${params.length}`); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const sql = `SELECT c.*, f.nom_entreprise, cl.id as client_id,
                        u.nom_complet as client_nom
                 FROM commandes c
                 LEFT JOIN fournisseurs f ON c.fournisseur_id = f.id
                 LEFT JOIN clients cl ON c.client_id = cl.id
                 LEFT JOIN utilisateurs u ON cl.utilisateur_id = u.id
                 ${whereClause}
                 ORDER BY c.date_commande DESC
                 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    params.push(limit, offset);

    const result = await db.query(sql, params);

    return res.json({
      success: true,
      data: result.rows.map(order => ({
        id: order.id,
        numero_suivi: `ORD-${(order.id || '').substring(0, 8).toUpperCase()}`,
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

    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Order not found' });

    const order = result.rows[0];
    const items = await db.query('SELECT * FROM lignes_commande WHERE commande_id = $1', [id]);

    return res.json({ success: true, data: { ...order, items: items.rows } });
  } catch (error) {
    console.error('Error fetching order:', error);
    return res.status(500).json({ success: false, message: 'Error fetching order' });
  }
});

// POST create admin user
router.post('/utilisateurs', authMiddleware, checkRole('admin'), async (req, res) => {
  const client = await db.connect();
  try {
    const { email, mot_de_passe, nom_complet, telephone, role, statut } = req.body;

    // Validation
    if (!email || !mot_de_passe || !nom_complet) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email, mot de passe et nom complet sont requis' 
      });
    }

    // Vérifier que le rôle est admin
    if (role && role !== 'admin') {
      return res.status(400).json({ 
        success: false, 
        message: 'Seul le rôle admin peut être créé via cette route' 
      });
    }

    // Vérifier si l'email existe déjà
    const existsRes = await client.query('SELECT 1 FROM utilisateurs WHERE email = $1', [email]);
    if (existsRes.rowCount > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'Cet email est déjà utilisé' 
      });
    }

    await client.query('BEGIN');

    // Hasher le mot de passe
    const bcrypt = require('bcrypt');
    const SALT_ROUNDS = 10;
    const hashed = await bcrypt.hash(mot_de_passe, SALT_ROUNDS);
    const userId = require('uuid').v4();

    // Créer l'utilisateur admin
    await client.query(
      `INSERT INTO utilisateurs (id, email, mot_de_passe, nom_complet, telephone, role, statut, date_creation)
       VALUES ($1, $2, $3, $4, $5, 'admin', $6, now())`,
      [userId, email, hashed, nom_complet, telephone || null, statut || 'actif']
    );

    // Créer l'entrée dans la table admins
    await client.query(
      `INSERT INTO admins (id, utilisateur_id) VALUES ($1, $2)`,
      [require('uuid').v4(), userId]
    );

    await client.query('COMMIT');

    return res.status(201).json({ 
      success: true, 
      message: 'Administrateur créé avec succès',
      utilisateur: {
        id: userId,
        email: email,
        nom_complet: nom_complet,
        role: 'admin',
        statut: statut || 'actif'
      }
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error creating admin:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la création de l\'administrateur',
      details: error.message 
    });
  } finally {
    client.release();
  }
});

module.exports = router;
