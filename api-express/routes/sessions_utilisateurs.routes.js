// routes/sessions_utilisateurs.routes.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authMiddleware, checkRole } = require('../middleware/auth.middleware');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.user_id || req.user.utilisateur_id;
    const tokenFromReq = req.user.token || req.headers['x-session-token'] || null;

    const result = await db.query(
      `SELECT id, token_session, date_creation, date_expiration, est_active, adresse_ip, user_agent
       FROM sessions_utilisateurs
       WHERE utilisateur_id = $1
       ORDER BY date_creation DESC`,
      [userId]
    );

    const sessions = result.rows.map(session => {
      const t = session.token_session || '';
      return {
        id: session.id,
        token: (t.length > 24) ? `${t.substring(0, 20)}...` : t,
        created_at: session.date_creation,
        expires_at: session.date_expiration,
        is_active: !!session.est_active,
        ip_address: session.adresse_ip,
        user_agent: session.user_agent,
        is_current: tokenFromReq ? (t === tokenFromReq) : false
      };
    });

    return res.json({ success: true, data: sessions, total: sessions.length });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return res.status(500).json({ success: false, message: 'Error fetching sessions', error: error.message });
  }
});

router.get('/:session_id', authMiddleware, async (req, res) => {
  try {
    const { session_id } = req.params;
    const userId = req.user.user_id || req.user.utilisateur_id;

    const result = await db.query(`SELECT * FROM sessions_utilisateurs WHERE id = $1 AND utilisateur_id = $2`, [session_id, userId]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Session not found' });

    const session = result.rows[0];
    const t = session.token_session || '';
    return res.json({
      success: true,
      data: {
        id: session.id,
        token: (t.length > 24) ? `${t.substring(0, 20)}...` : t,
        created_at: session.date_creation,
        expires_at: session.date_expiration,
        is_active: !!session.est_active,
        ip_address: session.adresse_ip,
        user_agent: session.user_agent
      }
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    return res.status(500).json({ success: false, message: 'Error fetching session' });
  }
});

router.patch('/:session_id/logout', authMiddleware, async (req, res) => {
  try {
    const { session_id } = req.params;
    const userId = req.user.user_id || req.user.utilisateur_id;

    const verifyRes = await db.query('SELECT id FROM sessions_utilisateurs WHERE id = $1 AND utilisateur_id = $2', [session_id, userId]);
    if (!verifyRes.rows.length) return res.status(404).json({ success: false, message: 'Session not found' });

    const result = await db.query(`UPDATE sessions_utilisateurs SET est_active = false WHERE id = $1 RETURNING id, token_session`, [session_id]);

    console.log(`[SESSION] Session ${session_id} logged out for user ${userId}`);

    const t = result.rows[0].token_session || '';
    return res.json({ success: true, message: 'Session logged out successfully', data: { id: result.rows[0].id, token: (t.length>24)?`${t.substring(0,20)}...`:t } });
  } catch (error) {
    console.error('Error logging out session:', error);
    return res.status(500).json({ success: false, message: 'Error logging out session' });
  }
});

router.post('/logout-all', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.user_id || req.user.utilisateur_id;
    const result = await db.query(`UPDATE sessions_utilisateurs SET est_active = false WHERE utilisateur_id = $1 RETURNING id`, [userId]);

    console.log(`[SESSION] All ${result.rows.length} sessions logged out for user ${userId}`);

    return res.json({ success: true, message: `Logged out from ${result.rows.length} device(s)`, data: { sessions_invalidated: result.rows.length } });
  } catch (error) {
    console.error('Error logging out all sessions:', error);
    return res.status(500).json({ success: false, message: 'Error logging out all sessions' });
  }
});

router.post('/revoke', authMiddleware, async (req, res) => {
  try {
    const { session_token } = req.body;
    if (!session_token) return res.status(400).json({ success: false, message: 'Session token is required' });

    const findRes = await db.query(`SELECT id FROM sessions_utilisateurs WHERE token_session = $1 AND est_active = true`, [session_token]);
    if (!findRes.rows.length) return res.status(404).json({ success: false, message: 'Session not found or already revoked' });

    await db.query(`UPDATE sessions_utilisateurs SET est_active = false WHERE id = $1`, [findRes.rows[0].id]);

    console.log(`[SESSION] Session revoked: ${findRes.rows[0].id}`);

    return res.json({ success: true, message: 'Session revoked successfully' });
  } catch (error) {
    console.error('Error revoking session:', error);
    return res.status(500).json({ success: false, message: 'Error revoking session' });
  }
});

router.get('/cleanup/expired', authMiddleware, checkRole('admin'), async (req, res) => {
  try {
    const result = await db.query(`DELETE FROM sessions_utilisateurs WHERE date_expiration < (CURRENT_TIMESTAMP - INTERVAL '30 days') RETURNING id`);
    console.log(`[SESSION] Cleaned up ${result.rows.length} expired sessions`);
    return res.json({ success: true, message: `Cleaned up ${result.rows.length} expired sessions`, data: { deleted_count: result.rows.length } });
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
    return res.status(500).json({ success: false, message: 'Error cleaning up sessions' });
  }
});

router.post('/validate', async (req, res) => {
  try {
    const { session_token } = req.body;
    if (!session_token) return res.status(400).json({ success: false, message: 'Session token is required' });

    const result = await db.query(
      `SELECT s.id, s.est_active, s.date_expiration, u.id as user_id, u.role, u.email
       FROM sessions_utilisateurs s
       JOIN utilisateurs u ON s.utilisateur_id = u.id
       WHERE s.token_session = $1`,
      [session_token]
    );

    if (!result.rows.length) return res.status(401).json({ success: false, message: 'Session not found' });

    const session = result.rows[0];
    const isValid = session.est_active && new Date(session.date_expiration) > new Date();

    if (!isValid) return res.status(401).json({ success: false, message: 'Session is invalid or expired' });

    return res.json({ success: true, message: 'Session is valid', data: { is_valid: true, expires_at: session.date_expiration, user: { id: session.user_id, email: session.email, role: session.role } } });
  } catch (error) {
    console.error('Error validating session:', error);
    return res.status(500).json({ success: false, message: 'Error validating session' });
  }
});

router.post('/extend', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.user_id || req.user.utilisateur_id;
    const currentToken = req.user.token || req.headers['x-session-token'];
    if (!currentToken) return res.status(400).json({ success: false, message: 'Current token required to extend' });

    const findRes = await db.query(`SELECT id FROM sessions_utilisateurs WHERE token_session = $1 AND utilisateur_id = $2 AND est_active = true`, [currentToken, userId]);
    if (!findRes.rows.length) return res.status(404).json({ success: false, message: 'Current session not found' });

    const newExpiration = new Date(); newExpiration.setHours(newExpiration.getHours() + 24);

    const result = await db.query(`UPDATE sessions_utilisateurs SET date_expiration = $2 WHERE id = $1 RETURNING date_expiration`, [findRes.rows[0].id, newExpiration]);

    console.log(`[SESSION] Session extended for user ${userId}`);

    return res.json({ success: true, message: 'Session extended successfully', data: { expires_at: result.rows[0].date_expiration } });
  } catch (error) {
    console.error('Error extending session:', error);
    return res.status(500).json({ success: false, message: 'Error extending session' });
  }
});

module.exports = router;
