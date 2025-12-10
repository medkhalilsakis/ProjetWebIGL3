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
       WHERE c.utilisateur_id = $1 LIMIT 1`,
      [req.user.user_id]
    );

    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Client profile not found' });

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
    let limit = parseInt(req.query.limit, 10) || 50;
    let offset = parseInt(req.query.offset, 10) || 0;
    if (limit < 1) limit = 1;
    if (limit > 500) limit = 500;
    if (offset < 0) offset = 0;

    const clientResult = await db.query('SELECT id FROM clients WHERE utilisateur_id = $1 LIMIT 1', [req.user.user_id]);
    if (clientResult.rows.length === 0) return res.json({ success: true, data: [] });
    const clientId = clientResult.rows[0].id;

    const params = [clientId];
    let idx = 2;
    let query = `SELECT c.*, f.nom_entreprise, u_livreur.nom_complet as livreur_nom
                 FROM commandes c
                 LEFT JOIN fournisseurs f ON c.fournisseur_id = f.id
                 LEFT JOIN livreurs l ON c.livreur_id = l.id
                 LEFT JOIN utilisateurs u_livreur ON l.utilisateur_id = u_livreur.id
                 WHERE c.client_id = $1`;

    if (req.query.status) {
      query += ` AND c.statut = $${idx++}`;
      params.push(req.query.status);
    }

    query += ` ORDER BY c.date_commande DESC LIMIT $${idx++} OFFSET $${idx++}`;
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
        instructions_speciales: order.instructions_speciales,
        livreur_nom: order.livreur_nom || null
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
    const clientResult = await db.query('SELECT id FROM clients WHERE utilisateur_id = $1 LIMIT 1', [req.user.user_id]);
    if (clientResult.rows.length === 0) return res.json({ success: true, data: [] });
    const clientId = clientResult.rows[0].id;

    const result = await db.query(
      `SELECT a.id, a.rue, a.code_postal, a.ville, a.type_adresse, a.coordonnees_gps, ca.est_principale
       FROM adresses a
       JOIN client_adresses ca ON ca.adresse_id = a.id
       WHERE ca.client_id = $1
       ORDER BY ca.date_ajout DESC`,
      [clientId]
    );

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching addresses:', error);
    return res.status(500).json({ success: false, message: 'Error fetching addresses' });
  }
});

// POST add address
router.post('/adresses', authMiddleware, checkRole('client'), async (req, res) => {
  try {
    const { rue, code_postal, ville, type_adresse, latitude, longitude } = req.body;

    const clientResult = await db.query('SELECT id FROM clients WHERE utilisateur_id = $1 LIMIT 1', [req.user.user_id]);
    if (clientResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Client not found' });
    const clientId = clientResult.rows[0].id;

    const lon = Number(longitude);
    const lat = Number(latitude);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      return res.status(400).json({ success: false, message: 'Coordonnées invalides' });
    }

    const adresseId = uuidv4();
    await db.query(
      `INSERT INTO adresses (id, rue, code_postal, ville, type_adresse, coordonnees_gps, date_creation)
       VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326), now())`,
      [adresseId, rue || '', code_postal || '', ville || '', type_adresse || 'domicile', lon, lat]
    );

    await db.query(
      `INSERT INTO client_adresses (client_id, adresse_id, est_principale, date_ajout)
       VALUES ($1, $2, false, now())`,
      [clientId, adresseId]
    );

    return res.status(201).json({ success: true, message: 'Address added successfully', data: { id: adresseId } });
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

    const clientResult = await db.query('SELECT id FROM clients WHERE utilisateur_id = $1 LIMIT 1', [req.user.user_id]);
    if (clientResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Client not found' });
    const clientId = clientResult.rows[0].id;

    // vérifier appartenance via table de liaison
    const addrCheck = await db.query('SELECT 1 FROM client_adresses WHERE adresse_id = $1 AND client_id = $2 LIMIT 1', [id, clientId]);
    if (addrCheck.rowCount === 0) return res.status(404).json({ success: false, message: 'Adresse introuvable' });

    const lon = Number(longitude);
    const lat = Number(latitude);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      return res.status(400).json({ success: false, message: 'Coordonnées invalides' });
    }

    await db.query(
      `UPDATE adresses 
       SET rue = $1, code_postal = $2, ville = $3, type_adresse = $4, 
           coordonnees_gps = ST_SetSRID(ST_MakePoint($5, $6), 4326), derniere_mise_a_jour = now()
       WHERE id = $7`,
      [rue || '', code_postal || '', ville || '', type_adresse || 'domicile', lon, lat, id]
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

    const clientResult = await db.query('SELECT id FROM clients WHERE utilisateur_id = $1 LIMIT 1', [req.user.user_id]);
    if (clientResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Client not found' });
    const clientId = clientResult.rows[0].id;

    const delLink = await db.query('DELETE FROM client_adresses WHERE adresse_id = $1 AND client_id = $2 RETURNING adresse_id', [id, clientId]);
    if (delLink.rowCount === 0) return res.status(404).json({ success: false, message: 'Adresse introuvable' });

    await db.query('DELETE FROM adresses WHERE id = $1', [id]);

    return res.json({ success: true, message: 'Address deleted successfully' });
  } catch (error) {
    console.error('Error deleting address:', error);
    return res.status(500).json({ success: false, message: 'Error deleting address' });
  }
});

module.exports = router;
