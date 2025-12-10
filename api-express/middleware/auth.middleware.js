// middleware/auth.middleware.js
const db = require('../config/database');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const authMiddleware = async (req, res, next) => {
  try {
    // Récupération sûre du token depuis plusieurs sources
    const authHeader = (req.headers && (req.headers.authorization || req.headers.Authorization)) || req.get?.('authorization') || null;
    const tokenFromHeader = authHeader ? String(authHeader).replace(/^Bearer\s+/i, '') : null;
    const tokenFromBody = (req.body && typeof req.body === 'object' && req.body.session_token) ? req.body.session_token : null;
    const tokenFromQuery = (req.query && req.query.session_token) ? req.query.session_token : null;

    const sessionToken = tokenFromHeader || tokenFromBody || tokenFromQuery;

    if (!sessionToken) {
      return res.status(401).json({ success: false, message: 'Token manquant' });
    }

    let decoded;
    try {
      decoded = jwt.verify(sessionToken, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ success: false, message: 'Token invalide ou expiré' });
    }

    // Vérifier que l'utilisateur existe toujours
    const userRes = await db.query(
      `SELECT id, email, role, nom_complet, statut, photo_profil FROM utilisateurs WHERE id = $1 LIMIT 1`,
      [decoded.user_id]
    );
    if (!userRes.rows.length) {
      return res.status(401).json({ success: false, message: 'Utilisateur introuvable' });
    }
    const userRow = userRes.rows[0];

    req.user = {
      user_id: userRow.id,
      id: userRow.id,
      utilisateur_id: userRow.id,
      role: userRow.role,
      email: userRow.email,
      nom_complet: userRow.nom_complet,
      statut: userRow.statut,
      photo_profil: userRow.photo_profil,
      token: sessionToken
    };

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
