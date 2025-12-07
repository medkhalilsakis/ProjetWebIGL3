// routes/audit_utilisateurs.routes.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authMiddleware, checkRole } = require('../middleware/auth.middleware');

// GET user audit logs
router.get('/', authMiddleware, checkRole('admin'), async (req, res) => {
  try {
    const { utilisateur_id, action, limit = 100, offset = 0 } = req.query;

    let query = 'SELECT * FROM audit_utilisateurs';
    const params = [];
    let paramCount = 1;

    if (utilisateur_id) {
      query += ` WHERE utilisateur_id = $${paramCount++}`;
      params.push(utilisateur_id);
    }

    if (action) {
      query += (utilisateur_id ? ' AND' : ' WHERE') + ` action = $${paramCount++}`;
      params.push(action);
    }

    query += ` ORDER BY date_action DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    return res.json({
      success: true,
      data: result.rows.map(log => ({
        id: log.id,
        utilisateur_id: log.utilisateur_id,
        action: log.action,
        detailsModifications: log.details_modifications,
        adresseIp: log.adresse_ip,
        dateAction: log.date_action
      }))
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return res.status(500).json({ success: false, message: 'Error fetching logs' });
  }
});

// GET user audit logs for specific user
router.get('/utilisateur/:utilisateur_id', authMiddleware, checkRole('admin'), async (req, res) => {
  try {
    const { utilisateur_id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const result = await db.query(
      `SELECT * FROM audit_utilisateurs 
       WHERE utilisateur_id = $1
       ORDER BY date_action DESC
       LIMIT $2 OFFSET $3`,
      [utilisateur_id, limit, offset]
    );

    return res.json({
      success: true,
      data: result.rows.map(log => ({
        id: log.id,
        action: log.action,
        detailsModifications: log.details_modifications,
        adresseIp: log.adresse_ip,
        dateAction: log.date_action
      }))
    });
  } catch (error) {
    console.error('Error fetching user audit logs:', error);
    return res.status(500).json({ success: false, message: 'Error fetching logs' });
  }
});

module.exports = router;
