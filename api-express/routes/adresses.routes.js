// routes/adresses.routes.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');

// GET all addresses for user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, rue, code_postal, ville, type_adresse, created_at
       FROM adresses 
       WHERE client_id IN (SELECT id FROM clients WHERE utilisateur_id = $1)
       ORDER BY created_at DESC`,
      [req.user.user_id]
    );

    return res.json({
      success: true,
      data: result.rows.map(addr => ({
        id: addr.id,
        rue: addr.rue,
        code_postal: addr.code_postal,
        ville: addr.ville,
        type_adresse: addr.type_adresse
      }))
    });
  } catch (error) {
    console.error('Error fetching addresses:', error);
    return res.status(500).json({ success: false, message: 'Error fetching addresses' });
  }
});

// GET address by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT * FROM adresses WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    const addr = result.rows[0];
    return res.json({
      success: true,
      data: {
        id: addr.id,
        rue: addr.rue,
        code_postal: addr.code_postal,
        ville: addr.ville,
        type_adresse: addr.type_adresse,
        coordonnees_gps: addr.coordonnees_gps
      }
    });
  } catch (error) {
    console.error('Error fetching address:', error);
    return res.status(500).json({ success: false, message: 'Error fetching address' });
  }
});

// POST create address
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { rue, code_postal, ville, type_adresse, latitude, longitude } = req.body;

    const clientResult = await db.query(
      'SELECT id FROM clients WHERE utilisateur_id = $1',
      [req.user.user_id]
    );

    if (clientResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const adresseId = uuidv4();
    await db.query(
      `INSERT INTO adresses (id, client_id, rue, code_postal, ville, type_adresse, coordonnees_gps, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7, $8), 4326), now())`,
      [adresseId, clientResult.rows[0].id, rue, code_postal, ville, type_adresse, longitude, latitude]
    );

    return res.status(201).json({
      success: true,
      message: 'Address created',
      data: { id: adresseId }
    });
  } catch (error) {
    console.error('Error creating address:', error);
    return res.status(500).json({ success: false, message: 'Error creating address' });
  }
});

// PUT update address
router.put('/:id', authMiddleware, async (req, res) => {
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

    return res.json({ success: true, message: 'Address updated' });
  } catch (error) {
    console.error('Error updating address:', error);
    return res.status(500).json({ success: false, message: 'Error updating address' });
  }
});

// DELETE address
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    await db.query('DELETE FROM adresses WHERE id = $1', [id]);

    return res.json({ success: true, message: 'Address deleted' });
  } catch (error) {
    console.error('Error deleting address:', error);
    return res.status(500).json({ success: false, message: 'Error deleting address' });
  }
});

module.exports = router;
