// routes/adresses.routes.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');

function parseLimitOffset(qLimit, qOffset, defaultLimit = 50) {
  let limit = parseInt(qLimit, 10) || defaultLimit;
  let offset = parseInt(qOffset, 10) || 0;
  if (limit < 1) limit = 1;
  if (limit > 1000) limit = 1000;
  if (offset < 0) offset = 0;
  return { limit, offset };
}

// GET all addresses for user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.id, a.rue, a.code_postal, a.ville, a.type_adresse, a.date_creation, ca.est_principale
       FROM adresses a
       JOIN client_adresses ca ON ca.adresse_id = a.id
       JOIN clients c ON ca.client_id = c.id
       WHERE c.utilisateur_id = $1
       ORDER BY ca.date_ajout DESC`,
      [req.user.user_id]
    );

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching addresses:', error);
    return res.status(500).json({ success: false, message: 'Error fetching addresses' });
  }
});

// GET address by ID (only owner)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT a.* FROM adresses a
       JOIN clients c ON a.client_id = c.id
       WHERE a.id = $1 AND c.utilisateur_id = $2`,
      [id, req.user.user_id]
    );

    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Address not found' });

    const addr = result.rows[0];
    return res.json({ success: true, data: addr });
  } catch (error) {
    console.error('Error fetching address:', error);
    return res.status(500).json({ success: false, message: 'Error fetching address' });
  }
});

// POST create address
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { rue, code_postal, ville, type_adresse, latitude, longitude } = req.body;

    const clientResult = await db.query('SELECT id FROM clients WHERE utilisateur_id = $1 LIMIT 1', [req.user.user_id]);
    if (clientResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Client not found' });
    const clientId = clientResult.rows[0].id;

    const lon = Number(longitude);
    const lat = Number(latitude);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return res.status(400).json({ success: false, message: 'Coordonnées invalides' });

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

    return res.status(201).json({ success: true, message: 'Address created', data: { id: adresseId } });
  } catch (error) {
    console.error('Error creating address:', error);
    return res.status(500).json({ success: false, message: 'Error creating address' });
  }
});

// PUT update address (only owner)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { rue, code_postal, ville, type_adresse, latitude, longitude } = req.body;

    const clientResult = await db.query('SELECT id FROM clients WHERE utilisateur_id = $1 LIMIT 1', [req.user.user_id]);
    if (clientResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Client not found' });
    const clientId = clientResult.rows[0].id;

    // Verify owner
    const addrCheck = await db.query('SELECT 1 FROM client_adresses WHERE adresse_id = $1 AND client_id = $2 LIMIT 1', [id, clientId]);
    if (addrCheck.rowCount === 0) return res.status(404).json({ success: false, message: 'Adresse introuvable' });

    const lon = Number(longitude);
    const lat = Number(latitude);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return res.status(400).json({ success: false, message: 'Coordonnées invalides' });

    await db.query(
      `UPDATE adresses 
       SET rue = $1, code_postal = $2, ville = $3, type_adresse = $4,
           coordonnees_gps = ST_SetSRID(ST_MakePoint($5, $6), 4326), derniere_mise_a_jour = now()
       WHERE id = $7`,
      [rue || '', code_postal || '', ville || '', type_adresse || 'domicile', lon, lat, id]
    );

    return res.json({ success: true, message: 'Address updated' });
  } catch (error) {
    console.error('Error updating address:', error);
    return res.status(500).json({ success: false, message: 'Error updating address' });
  }
});

// DELETE address (only owner)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const clientResult = await db.query('SELECT id FROM clients WHERE utilisateur_id = $1 LIMIT 1', [req.user.user_id]);
    if (clientResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Client not found' });
    const clientId = clientResult.rows[0].id;

    const delLink = await db.query('DELETE FROM client_adresses WHERE adresse_id = $1 AND client_id = $2 RETURNING adresse_id', [id, clientId]);
    if (delLink.rowCount === 0) return res.status(404).json({ success: false, message: 'Address not found or not owned' });

    await db.query('DELETE FROM adresses WHERE id = $1', [id]);

    return res.json({ success: true, message: 'Address deleted' });
  } catch (error) {
    console.error('Error deleting address:', error);
    return res.status(500).json({ success: false, message: 'Error deleting address' });
  }
});

module.exports = router;
