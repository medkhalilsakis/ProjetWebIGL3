// routes/auth.routes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const crypto = require('crypto');

const SALT_ROUNDS = 10;

/**
 * Create a new user session in sessions_utilisateurs table
 * Manages session creation with IP and user-agent tracking
 */
async function createUserSession(user, req) {
  try {
    const sessionToken = crypto.randomBytes(48).toString('hex');
    const sessionId = uuidv4();
    const expiration = new Date();
    expiration.setHours(expiration.getHours() + 24);

    const result = await db.query(
      `INSERT INTO sessions_utilisateurs (id, utilisateur_id, token_session, date_expiration, adresse_ip, user_agent, est_active, date_creation)
       VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP)
       RETURNING id, token_session, date_expiration, est_active, date_creation`,
      [sessionId, user.id, sessionToken, expiration, req.ip || req.connection.remoteAddress, req.headers['user-agent']]
    );

    // Update user's last login timestamp
    await db.query(
      'UPDATE utilisateurs SET derniere_connexion = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error creating session:', error);
    throw error;
  }
}

/**
 * Invalidate a user session
 */
async function invalidateSession(sessionToken) {
  try {
    const result = await db.query(
      `UPDATE sessions_utilisateurs 
       SET est_active = false 
       WHERE token_session = $1 
       RETURNING id, utilisateur_id`,
      [sessionToken]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error invalidating session:', error);
    throw error;
  }
}

/**
 * Get user with all role-specific data joined
 */
async function getUserWithRoles(email) {
  try {
    const result = await db.query(
      `SELECT u.*, 
              c.id as client_id, 
              f.id as fournisseur_id, 
              l.id as livreur_id, 
              a.id as admin_id
       FROM utilisateurs u
       LEFT JOIN clients c ON u.id = c.utilisateur_id
       LEFT JOIN fournisseurs f ON u.id = f.utilisateur_id
       LEFT JOIN livreurs l ON u.id = l.utilisateur_id
       LEFT JOIN admins a ON u.id = a.utilisateur_id
       WHERE u.email = $1`,
      [email]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
}

// ============================================
// Register (inscription)
// ============================================
router.post('/register', async (req, res) => {
  const client = await db.connect();
  try {
    const { email, mot_de_passe, nom_complet, telephone, role, additional_data } = req.body;

    // Validate input
    if (!email || !mot_de_passe || !nom_complet || !role) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Email, password, name, and role are required'
      });
    }

    const { rowCount } = await client.query('SELECT 1 FROM utilisateurs WHERE email = $1', [email]);
    if (rowCount > 0) {
      return res.status(409).json({
        success: false,
        code: 'EMAIL_EXISTS',
        message: 'Email already registered'
      });
    }

    await client.query('BEGIN');

    const hashed = await bcrypt.hash(mot_de_passe, SALT_ROUNDS);
    const userId = uuidv4();

    await client.query(
      `INSERT INTO utilisateurs (id, email, mot_de_passe, nom_complet, telephone, role, statut, date_creation)
       VALUES ($1,$2,$3,$4,$5,$6,'actif', now())`,
      [userId, email, hashed, nom_complet || null, telephone || null, role]
    );

    // Create role-specific data
    if (role === 'client') {
      await client.query('INSERT INTO clients (id, utilisateur_id) VALUES ($1,$2)', [uuidv4(), userId]);
    } else if (role === 'livreur') {
      const { type_vehicule, numero_permis } = additional_data || {};
      await client.query(
        'INSERT INTO livreurs (id, utilisateur_id, type_vehicule, numero_permis) VALUES ($1,$2,$3,$4)',
        [uuidv4(), userId, type_vehicule || null, numero_permis || null]
      );
    } else if (role === 'fournisseur') {
      const { nom_entreprise, type_fournisseur, adresse } = additional_data || {};
      const adresseId = uuidv4();
      if (adresse) {
        await client.query(
          `INSERT INTO adresses (id, rue, code_postal, ville, coordonnees_gps, type_adresse)
           VALUES ($1,$2,$3,$4, ST_SetSRID(ST_MakePoint($5, $6), 4326), 'entreprise')`,
          [adresseId, adresse.rue, adresse.code_postal, adresse.ville, adresse.longitude, adresse.latitude]
        );
      }
      await client.query(
        `INSERT INTO fournisseurs (id, utilisateur_id, nom_entreprise, type_fournisseur, adresse_id)
         VALUES ($1,$2,$3,$4,$5)`,
        [uuidv4(), userId, nom_entreprise || null, type_fournisseur || null, adresseId]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      userId
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Registration error:', err);
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  } finally {
    client.release();
  }
});

// ============================================
// Login — body: { email, mot_de_passe }
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { email, mot_de_passe } = req.body;

    // Validate input
    if (!email || !mot_de_passe) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Email and password are required'
      });
    }

    // Get user with all roles
    const user = await getUserWithRoles(email);

    if (!user) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    }

    // Verify password
    const match = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
    if (!match) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    }

    // Check if account is active
    if (user.statut !== 'actif' && user.statut !== 'verifie') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_INACTIVE',
        message: `Account is ${user.statut}. Contact support.`
      });
    }

    // Create session using sessions_utilisateurs table
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

    res.json({
      success: true,
      message: 'Login successful',
      user: userData
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// ============================================
// Logout — body: { session_token }
// ============================================
router.post('/logout', async (req, res) => {
  try {
    const { session_token } = req.body;

    if (!session_token) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Session token is required'
      });
    }

    // Invalidate session via sessions_utilisateurs table
    const invalidated = await invalidateSession(session_token);

    if (!invalidated) {
      return res.status(404).json({
        success: false,
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found or already logged out'
      });
    }

    console.log(`[AUTH] Session invalidated: ${invalidated.id}`);

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

// ============================================
// Verify session — body: { session_token }
// ============================================
router.post('/verify-session', async (req, res) => {
  try {
    const { session_token } = req.body;

    if (!session_token) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Session token is required'
      });
    }

    const result = await db.query(
      `SELECT s.id, 
              s.token_session, 
              s.est_active, 
              s.date_expiration,
              s.utilisateur_id,
              u.id as user_id,
              u.role, 
              u.email, 
              u.nom_complet, 
              u.photo_profil,
              u.statut
       FROM sessions_utilisateurs s
       JOIN utilisateurs u ON s.utilisateur_id = u.id
       WHERE s.token_session = $1 
         AND s.est_active = true 
         AND s.date_expiration > CURRENT_TIMESTAMP`,
      [session_token]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        code: 'SESSION_INVALID',
        message: 'Session is invalid or expired'
      });
    }

    const session = result.rows[0];

    res.json({
      success: true,
      session: {
        id: session.id,
        token: session.token_session,
        is_active: session.est_active,
        expires_at: session.date_expiration
      },
      user: {
        id: session.user_id,
        email: session.email,
        nom_complet: session.nom_complet,
        role: session.role,
        statut: session.statut,
        photo_profil: session.photo_profil
      }
    });
  } catch (err) {
    console.error('Session verification error:', err);
    res.status(500).json({
      success: false,
      message: 'Session verification failed'
    });
  }
});

module.exports = router;
