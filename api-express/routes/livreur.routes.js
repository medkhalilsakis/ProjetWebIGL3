// routes/livreur.routes.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authMiddleware, checkRole } = require('../middleware/auth.middleware');

// GET livreur profile
router.get('/profile', authMiddleware, checkRole('livreur'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT l.*, u.email, u.nom_complet, u.telephone, u.photo_profil
       FROM livreurs l
       JOIN utilisateurs u ON l.utilisateur_id = u.id
       WHERE l.utilisateur_id = $1`,
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Livreur profile not found' });
    }

    const livreur = result.rows[0];
    return res.json({
      success: true,
      data: {
        id: livreur.id,
        email: livreur.email,
        nom_complet: livreur.nom_complet,
        telephone: livreur.telephone,
        photo_profil: livreur.photo_profil,
        type_vehicule: livreur.type_vehicule,
        numero_permis: livreur.numero_permis,
        statut: livreur.statut,
        note_moyenne: livreur.note_moyenne,
        nombre_livraisons: livreur.nombre_livraisons
      }
    });
  } catch (error) {
    console.error('Error fetching livreur profile:', error);
    return res.status(500).json({ success: false, message: 'Error fetching profile' });
  }
});

// GET available deliveries
router.get('/commandes/disponibles', authMiddleware, checkRole('livreur'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, f.nom_entreprise, cl.id as client_id
       FROM commandes c
       JOIN fournisseurs f ON c.fournisseur_id = f.id
       JOIN clients cl ON c.client_id = cl.id
       WHERE c.statut = 'prete_pour_livraison' AND c.livreur_id IS NULL
       ORDER BY c.date_commande ASC`,
    );

    return res.json({
      success: true,
      data: result.rows.map(order => ({
        id: order.id,
        numero_suivi: `ORD-${order.id.substring(0, 8).toUpperCase()}`,
        fournisseur: order.nom_entreprise,
        montant_total: order.montant_total,
        adresse_livraison_id: order.adresse_livraison_id
      }))
    });
  } catch (error) {
    console.error('Error fetching available deliveries:', error);
    return res.status(500).json({ success: false, message: 'Error fetching deliveries' });
  }
});

// GET livreur active deliveries
router.get('/commandes/actives', authMiddleware, checkRole('livreur'), async (req, res) => {
  try {
    const livreurResult = await db.query(
      'SELECT id FROM livreurs WHERE utilisateur_id = $1',
      [req.user.user_id]
    );

    if (livreurResult.rows.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const result = await db.query(
      `SELECT c.*, f.nom_entreprise
       FROM commandes c
       JOIN fournisseurs f ON c.fournisseur_id = f.id
       WHERE c.livreur_id = $1 AND c.statut IN ('en_livraison', 'prete_pour_livraison')
       ORDER BY c.date_commande DESC`,
      [livreurResult.rows[0].id]
    );

    return res.json({
      success: true,
      data: result.rows.map(order => ({
        id: order.id,
        numero_suivi: `ORD-${order.id.substring(0, 8).toUpperCase()}`,
        fournisseur: order.nom_entreprise,
        montant_total: order.montant_total,
        statut: order.statut,
        adresse_livraison_id: order.adresse_livraison_id
      }))
    });
  } catch (error) {
    console.error('Error fetching active deliveries:', error);
    return res.status(500).json({ success: false, message: 'Error fetching deliveries' });
  }
});

// POST accept delivery
router.post('/commandes/:commande_id/accepter', authMiddleware, checkRole('livreur'), async (req, res) => {
  try {
    const { commande_id } = req.params;

    const livreurResult = await db.query(
      'SELECT id FROM livreurs WHERE utilisateur_id = $1',
      [req.user.user_id]
    );

    await db.query(
      `UPDATE commandes 
       SET livreur_id = $1, statut = 'acceptee_par_livreur'
       WHERE id = $2`,
      [livreurResult.rows[0].id, commande_id]
    );

    return res.json({ success: true, message: 'Delivery accepted' });
  } catch (error) {
    console.error('Error accepting delivery:', error);
    return res.status(500).json({ success: false, message: 'Error accepting delivery' });
  }
});

// PATCH update delivery status
router.patch('/commandes/:commande_id/statut', authMiddleware, checkRole('livreur'), async (req, res) => {
  try {
    const { commande_id } = req.params;
    const { statut, localisation } = req.body;

    let query = 'UPDATE commandes SET statut = $1';
    const params = [statut, commande_id];

    if (localisation) {
      query += `, coordonnees_livraison = ST_SetSRID(ST_MakePoint($3, $4), 4326)`;
      params.splice(1, 0, localisation.longitude, localisation.latitude);
    }

    query += ` WHERE id = $${params.length}`;
    params.push(commande_id);

    await db.query(query, params);

    return res.json({ success: true, message: 'Delivery status updated' });
  } catch (error) {
    console.error('Error updating delivery status:', error);
    return res.status(500).json({ success: false, message: 'Error updating status' });
  }
});

// GET delivery history
router.get('/historique', authMiddleware, checkRole('livreur'), async (req, res) => {
  try {
    const livreurResult = await db.query(
      'SELECT id FROM livreurs WHERE utilisateur_id = $1',
      [req.user.user_id]
    );

    if (livreurResult.rows.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const result = await db.query(
      `SELECT c.*, f.nom_entreprise
       FROM commandes c
       JOIN fournisseurs f ON c.fournisseur_id = f.id
       WHERE c.livreur_id = $1 AND c.statut = 'livree'
       ORDER BY c.date_commande DESC
       LIMIT 100`,
      [livreurResult.rows[0].id]
    );

    return res.json({
      success: true,
      data: result.rows.map(order => ({
        id: order.id,
        numero_suivi: `ORD-${order.id.substring(0, 8).toUpperCase()}`,
        fournisseur: order.nom_entreprise,
        montant_total: order.montant_total,
        date_commande: order.date_commande
      }))
    });
  } catch (error) {
    console.error('Error fetching delivery history:', error);
    return res.status(500).json({ success: false, message: 'Error fetching history' });
  }
});

module.exports = router;
