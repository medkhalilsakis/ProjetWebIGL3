// routes/audit_utilisateurs.routes.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authMiddleware, checkRole } = require('../middleware/auth.middleware');

function parseLimitOffset(qLimit, qOffset, defaultLimit = 100) {
  let limit = parseInt(qLimit, 10) || defaultLimit;
  let offset = parseInt(qOffset, 10) || 0;
  if (limit < 1) limit = 1;
  if (limit > 1000) limit = 1000;
  if (offset < 0) offset = 0;
  return { limit, offset };
}

// GET user audit logs
router.get('/', authMiddleware, checkRole('admin'), async (req, res) => {
  try {
    const { utilisateur_id, action } = req.query;
    const { limit, offset } = parseLimitOffset(req.query.limit, req.query.offset, 100);

    const where = [];
    const params = [];

    if (utilisateur_id) { params.push(utilisateur_id); where.push(`utilisateur_id = $${params.length}`); }
    if (action) { params.push(action); where.push(`action = $${params.length}`); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const sql = `SELECT * FROM audit_utilisateurs ${whereClause} ORDER BY date_action DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(sql, params);

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
    const { limit, offset } = parseLimitOffset(req.query.limit, req.query.offset, 50);

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
