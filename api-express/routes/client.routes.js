// routes/client.routes.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authMiddleware, checkRole } = require('../middleware/auth.middleware');

// GET client profile
router.get('/profile', authMiddleware, checkRole('client'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, u.email, u.nom_complet, u.telephone, u.photo_profil 
       FROM clients c 
       JOIN utilisateurs u ON c.utilisateur_id = u.id 
       WHERE c.utilisateur_id = $1`,
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Client profile not found' });
    }

    const client = result.rows[0];
    return res.json({
      success: true,
      data: {
        id: client.id,
        email: client.email,
        nom_complet: client.nom_complet,
        telephone: client.telephone,
        photo_profil: client.photo_profil,
        adresse_defaut: client.adresse_defaut_id,
        date_inscription: client.date_inscription
      }
    });
  } catch (error) {
    console.error('Error fetching client profile:', error);
    return res.status(500).json({ success: false, message: 'Error fetching profile' });
  }
});

// GET client orders
router.get('/commandes', authMiddleware, checkRole('client'), async (req, res) => {
  try {
    const { limit = 50, offset = 0, status } = req.query;

    const clientResult = await db.query(
      'SELECT id FROM clients WHERE utilisateur_id = $1',
      [req.user.user_id]
    );

    if (clientResult.rows.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const clientId = clientResult.rows[0].id;

    let query = `SELECT c.*, f.nom_entreprise, u.nom_complet as livreur_nom
                 FROM commandes c 
                 LEFT JOIN fournisseurs f ON c.fournisseur_id = f.id
                 LEFT JOIN utilisateurs u ON f.utilisateur_id = u.id
                 WHERE c.client_id = $1`;
    const params = [clientId];

    if (status) {
      query += ` AND c.statut = $2`;
      params.push(status);
    }

    query += ` ORDER BY c.date_commande DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    return res.json({
      success: true,
      data: result.rows.map(order => ({
        id: order.id,
        numero_suivi: `ORD-${order.id.substring(0, 8).toUpperCase()}`,
        fournisseur: order.nom_entreprise,
        montant_total: order.montant_total,
        statut: order.statut,
        date_commande: order.date_commande,
        adresse_livraison_id: order.adresse_livraison_id,
        instructions_speciales: order.instructions_speciales
      }))
    });
  } catch (error) {
    console.error('Error fetching client orders:', error);
    return res.status(500).json({ success: false, message: 'Error fetching orders' });
  }
});

// GET client addresses
router.get('/adresses', authMiddleware, checkRole('client'), async (req, res) => {
  try {
    const clientResult = await db.query(
      'SELECT id FROM clients WHERE utilisateur_id = $1',
      [req.user.user_id]
    );

    if (clientResult.rows.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const result = await db.query(
      `SELECT id, rue, code_postal, ville, type_adresse, coordonnees_gps 
       FROM adresses 
       WHERE client_id = $1 
       ORDER BY created_at DESC`,
      [clientResult.rows[0].id]
    );

    return res.json({
      success: true,
      data: result.rows.map(addr => ({
        id: addr.id,
        rue: addr.rue,
        code_postal: addr.code_postal,
        ville: addr.ville,
        type_adresse: addr.type_adresse,
        coordonnees_gps: addr.coordonnees_gps
      }))
    });
  } catch (error) {
    console.error('Error fetching addresses:', error);
    return res.status(500).json({ success: false, message: 'Error fetching addresses' });
  }
});

// POST add address
router.post('/adresses', authMiddleware, checkRole('client'), async (req, res) => {
  try {
    const { rue, code_postal, ville, type_adresse, latitude, longitude } = req.body;

    const clientResult = await db.query(
      'SELECT id FROM clients WHERE utilisateur_id = $1',
      [req.user.user_id]
    );

    const clientId = clientResult.rows[0].id;
    const adresseId = uuidv4();

    await db.query(
      `INSERT INTO adresses (id, client_id, rue, code_postal, ville, type_adresse, coordonnees_gps, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7, $8), 4326), now())`,
      [adresseId, clientId, rue, code_postal, ville, type_adresse, longitude, latitude]
    );

    return res.status(201).json({
      success: true,
      message: 'Address added successfully',
      data: { id: adresseId }
    });
  } catch (error) {
    console.error('Error adding address:', error);
    return res.status(500).json({ success: false, message: 'Error adding address' });
  }
});

// PUT update address
router.put('/adresses/:id', authMiddleware, checkRole('client'), async (req, res) => {
  try {
    const { id } = req.params;
    const { rue, code_postal, ville, type_adresse, latitude, longitude } = req.body;

    await db.query(
      `UPDATE adresses 
       SET rue = $1, code_postal = $2, ville = $3, type_adresse = $4, 
           coordonnees_gps = ST_SetSRID(ST_MakePoint($5, $6), 4326), updated_at = now()
       WHERE id = $7`,
      [rue, code_postal, ville, type_adresse, longitude, latitude, id]
    );

    return res.json({ success: true, message: 'Address updated successfully' });
  } catch (error) {
    console.error('Error updating address:', error);
    return res.status(500).json({ success: false, message: 'Error updating address' });
  }
});

// DELETE address
router.delete('/adresses/:id', authMiddleware, checkRole('client'), async (req, res) => {
  try {
    const { id } = req.params;

    await db.query('DELETE FROM adresses WHERE id = $1', [id]);

    return res.json({ success: true, message: 'Address deleted successfully' });
  } catch (error) {
    console.error('Error deleting address:', error);
    return res.status(500).json({ success: false, message: 'Error deleting address' });
  }
});

module.exports = router;
