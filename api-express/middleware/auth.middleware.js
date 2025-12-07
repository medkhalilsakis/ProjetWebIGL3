// middleware/auth.middleware.js
const db = require('../config/database');

const authMiddleware = async (req, res, next) => {
  try {
    // Récupération sûre du token depuis plusieurs sources :
    // - Header Authorization: "Bearer <token>"
    // - body.session_token (pour POST si tu l'envoies dans le body)
    // - query param ?session_token=...
    const authHeader = (req.headers && (req.headers.authorization || req.headers.Authorization)) || req.get?.('authorization') || null;
    const tokenFromHeader = authHeader ? String(authHeader).replace(/^Bearer\s+/i, '') : null;
    const tokenFromBody = (req.body && typeof req.body === 'object' && req.body.session_token) ? req.body.session_token : null;
    const tokenFromQuery = (req.query && req.query.session_token) ? req.query.session_token : null;

    const sessionToken = tokenFromHeader || tokenFromBody || tokenFromQuery;

    if (!sessionToken) {
      // Pas de token, on renvoie 401 (et on ne plante plus)
      return res.status(401).json({ success: false, message: 'Token manquant' });
    }

    const result = await db.query(
      `SELECT s.*, u.id as user_id, u.role, u.email, u.nom_complet, u.statut, u.photo_profil
       FROM sessions_utilisateurs s
       JOIN utilisateurs u ON s.utilisateur_id = u.id
       WHERE s.token_session = $1
         AND s.est_active = true
         AND s.date_expiration > CURRENT_TIMESTAMP`,
      [sessionToken]
    );

    if (!result || result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Session invalide ou expirée' });
    }

    req.user = result.rows[0];
    return next();
  } catch (error) {
    console.error('Erreur auth middleware:', error && error.stack ? error.stack : error);
    return res.status(500).json({ success: false, message: 'Erreur d\'authentification' });
  }
};

const checkRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Non authentifié' });
  if (!roles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Accès refusé' });
  next();
};

module.exports = { authMiddleware, checkRole };
