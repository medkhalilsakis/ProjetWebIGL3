// routes/auth.routes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

async function createUserSession(user, req) {
  try {
    // JWT stateless token
    const payload = {
      user_id: user.id,
      email: user.email,
      role: user.role,
      nom_complet: user.nom_complet,
      photo_profil: user.photo_profil
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Optionnel : conserver un enregistrement de session pour audit (stockage hashé pour respecter VARCHAR(255))
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex'); // 64 chars
    const sessionId = uuidv4();
    const expiration = new Date();
    expiration.setHours(expiration.getHours() + 24);
    await db.query(
      `INSERT INTO sessions_utilisateurs (id, utilisateur_id, token_session, date_expiration, adresse_ip, user_agent, est_active, date_creation)
       VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP)`,
      [sessionId, user.id, tokenHash, expiration, req.ip || req.connection?.remoteAddress, req.headers['user-agent'] || null]
    );
    await db.query('UPDATE utilisateurs SET derniere_connexion = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    return { id: sessionId, token_session: token, date_expiration: expiration };
  } catch (error) {
    console.error('Error creating session:', error);
    throw error;
  }
}

async function invalidateSession(sessionToken) {
  try {
    const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    const result = await db.query(
      `UPDATE sessions_utilisateurs SET est_active = false WHERE token_session = $1 RETURNING id, utilisateur_id`,
      [tokenHash]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error invalidating session:', error);
    throw error;
  }
}

async function getUserWithRoles(email) {
  try {
    const result = await db.query(
      `SELECT u.*, c.id as client_id, f.id as fournisseur_id, l.id as livreur_id, a.id as admin_id
       FROM utilisateurs u
       LEFT JOIN clients c ON u.id = c.utilisateur_id
       LEFT JOIN fournisseurs f ON u.id = f.utilisateur_id
       LEFT JOIN livreurs l ON u.id = l.utilisateur_id
       LEFT JOIN admins a ON u.id = a.utilisateur_id
       WHERE u.email = $1
       LIMIT 1`,
      [email]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
}

/* REGISTER */
router.post('/register', async (req, res) => {
  const client = await db.connect();
  try {
    const { email, mot_de_passe, nom_complet, telephone, role, additional_data = {} } = req.body;

    if (!email || !mot_de_passe || !nom_complet || !role) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Email, password, name, and role are required' });
    }

    const { rowCount } = await client.query('SELECT 1 FROM utilisateurs WHERE email = $1', [email]);
    if (rowCount > 0) {
      return res.status(409).json({ success: false, code: 'EMAIL_EXISTS', message: 'Email already registered' });
    }

    await client.query('BEGIN');

    const hashed = await bcrypt.hash(mot_de_passe, SALT_ROUNDS);
    const userId = uuidv4();

    await client.query(
      `INSERT INTO utilisateurs (id, email, mot_de_passe, nom_complet, telephone, role, statut, date_creation)
       VALUES ($1,$2,$3,$4,$5,$6,'actif', now())`,
      [userId, email, hashed, nom_complet || null, telephone || null, role]
    );

    if (role === 'client') {
      await client.query('INSERT INTO clients (id, utilisateur_id) VALUES ($1,$2)', [uuidv4(), userId]);
    } else if (role === 'livreur') {
      const { type_vehicule, numero_permis } = additional_data || {};
      await client.query('INSERT INTO livreurs (id, utilisateur_id, type_vehicule, numero_permis) VALUES ($1,$2,$3,$4)',
        [uuidv4(), userId, type_vehicule || null, numero_permis || null]);
    } else if (role === 'fournisseur') {
      const { nom_entreprise, type_fournisseur, adresse } = additional_data || {};
      const adresseId = adresse ? uuidv4() : null;

      if (adresse) {
        // Validate latitude/longitude presence
        const lon = Number(adresse.longitude);
        const lat = Number(adresse.latitude);
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
          throw new Error('Invalid coordinates for adresse (longitude/latitude)');
        }
        await client.query(
          `INSERT INTO adresses (id, rue, code_postal, ville, coordonnees_gps, type_adresse)
           VALUES ($1,$2,$3,$4, ST_SetSRID(ST_MakePoint($5,$6), 4326), 'entreprise')`,
          [adresseId, adresse.rue || null, adresse.code_postal || null, adresse.ville || null, lon, lat]
        );
      }

      await client.query(
        `INSERT INTO fournisseurs (id, utilisateur_id, nom_entreprise, type_fournisseur, adresse_id)
         VALUES ($1,$2,$3,$4,$5)`,
        [uuidv4(), userId, nom_entreprise || null, type_fournisseur || null, adresseId]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Registration successful', userId });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Registration error:', err);
    res.status(500).json({ success: false, message: 'Registration failed', details: err.message });
  } finally {
    client.release();
  }
});

/* LOGIN */
router.post('/login', async (req, res) => {
  try {
    const { email, mot_de_passe } = req.body;
    if (!email || !mot_de_passe) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Email and password are required' });
    }

    const user = await getUserWithRoles(email);
    if (!user) return res.status(401).json({ success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });

    const match = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
    if (!match) return res.status(401).json({ success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });

    if (user.statut !== 'actif' && user.statut !== 'verifie') {
      return res.status(403).json({ success: false, code: 'ACCOUNT_INACTIVE', message: `Account is ${user.statut}. Contact support.` });
    }

    const session = await createUserSession(user, req);

    const userData = {
      id: user.id,
      email: user.email,
      nom_complet: user.nom_complet,
      telephone: user.telephone,
      role: user.role,
      statut: user.statut,
      photo_profil: user.photo_profil,
      profile_id: user[`${user.role}_id`] || null,
      session_token: session.token_session,
      session_id: session.id,
      expires_at: session.date_expiration
    };

    console.log(`[AUTH] User logged in: ${user.email} (${user.role})`);

    res.json({ success: true, message: 'Login successful', user: userData });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

/* LOGOUT */
router.post('/logout', async (req, res) => {
  try {
    const { session_token } = req.body;
    if (!session_token) return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Session token is required' });

    // In JWT stateless mode we cannot revoke, but we mark inactive the stored session record for audit/compat.
    await invalidateSession(session_token).catch(() => {});

    res.json({ success: true, message: 'Logout successful' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
});

/* VERIFY SESSION */
router.post('/verify-session', async (req, res) => {
  try {
    const { session_token } = req.body;
    if (!session_token) return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Session token is required' });
    try {
      const decoded = jwt.verify(session_token, JWT_SECRET);
      // fetch user to ensure still exists/active
      const userRes = await db.query('SELECT id, email, role, nom_complet, statut, photo_profil FROM utilisateurs WHERE id = $1', [decoded.user_id]);
      if (!userRes.rows.length) {
        return res.status(401).json({ success: false, code: 'SESSION_INVALID', message: 'Utilisateur introuvable' });
      }
      const userRow = userRes.rows[0];
      return res.json({
        success: true,
        session: { token: session_token, is_active: true, expires_at: decoded.exp ? new Date(decoded.exp * 1000) : null },
        user: { id: userRow.id, email: userRow.email, nom_complet: userRow.nom_complet, role: userRow.role, statut: userRow.statut, photo_profil: userRow.photo_profil }
      });
    } catch (e) {
      return res.status(401).json({ success: false, code: 'SESSION_INVALID', message: 'Session is invalid or expired' });
    }
  } catch (err) {
    console.error('Session verification error:', err);
    res.status(500).json({ success: false, message: 'Session verification failed' });
  }
});

module.exports = router;
