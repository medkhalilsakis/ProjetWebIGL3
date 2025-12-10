// routes/utilisateurs.routes.js
const express = require('express');
const pool = require('../config/database');
const { body, param, query, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth.middleware');

const router = express.Router();
const SALT_ROUNDS = 10;

function sanitizeUser(row) {
  if (!row) return null;
  const { mot_de_passe, ...rest } = row;
  return rest;
}

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
    query('role').optional().isString(),
    query('search').optional().isString().trim(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const offset = (page - 1) * limit;
      const { role, search } = req.query;

      const where = [];
      const params = [];
      let idx = 1;
      if (role) {
        where.push(`role = $${idx++}`);
        params.push(role);
      }
      if (search) {
        // use same parameter for both email and nom_complet
        where.push(`(email ILIKE $${idx} OR nom_complet ILIKE $${idx})`);
        params.push(`%${search}%`);
        idx++;
      }
      const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

      const sql = `
        SELECT id, email, nom_complet, telephone, role, statut, photo_profil, date_creation, derniere_connexion
        FROM utilisateurs
        ${whereClause}
        ORDER BY date_creation DESC
        LIMIT $${idx++} OFFSET $${idx++}
      `;
      params.push(limit, offset);

      const { rows } = await pool.query(sql, params);
      res.json({ page, limit, count: rows.length, utilisateurs: rows.map(sanitizeUser) });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id',
  [param('id').isUUID().withMessage('id invalide')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { id } = req.params;
      const { rows } = await pool.query(
        `SELECT id, email, nom_complet, telephone, role, statut, photo_profil, date_creation, derniere_connexion
         FROM utilisateurs WHERE id = $1`,
        [id]
      );
      if (!rows[0]) return res.status(404).json({ message: 'Utilisateur non trouvé' });
      res.json(sanitizeUser(rows[0]));
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/',
  [
    body('email').isEmail().withMessage('Email invalide').normalizeEmail(),
    body('mot_de_passe').isLength({ min: 6 }).withMessage('Mot de passe min 6 caractères'),
    body('nom_complet').optional().isString().trim(),
    body('telephone').optional().isString().trim(),
    body('role').isIn(['client', 'fournisseur', 'livreur', 'admin']).withMessage('role invalide'),
    body('statut').optional().isString().trim(),
    body('photo_profil').optional().isString().trim(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { email, mot_de_passe, nom_complet, telephone, role, statut, photo_profil } = req.body;

      const existsRes = await pool.query('SELECT 1 FROM utilisateurs WHERE email = $1', [email]);
      if (existsRes.rowCount > 0) return res.status(409).json({ message: 'Email déjà utilisé' });

      const hashed = await bcrypt.hash(mot_de_passe, SALT_ROUNDS);
      const id = uuidv4();

      const insertSql = `
        INSERT INTO utilisateurs
          (id, email, mot_de_passe, nom_complet, telephone, role, statut, photo_profil, date_creation)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
        RETURNING id, email, nom_complet, telephone, role, statut, photo_profil, date_creation, derniere_connexion
      `;
      const { rows } = await pool.query(insertSql, [
        id,
        email,
        hashed,
        nom_complet || null,
        telephone || null,
        role,
        statut || 'actif',
        photo_profil || null,
      ]);

      res.status(201).json({ utilisateur: sanitizeUser(rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:id',
  [
    param('id').isUUID().withMessage('id invalide'),
    body('email').optional().isEmail().normalizeEmail(),
    body('mot_de_passe').optional().isLength({ min: 6 }),
    body('nom_complet').optional().isString().trim(),
    body('telephone').optional().isString().trim(),
    body('role').optional().isIn(['client', 'fournisseur', 'livreur', 'admin']),
    body('statut').optional().isString().trim(),
    body('photo_profil').optional().isString().trim(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { id } = req.params;
      const { email, mot_de_passe, nom_complet, telephone, role, statut, photo_profil } = req.body;

      const { rows: existingRows } = await pool.query('SELECT * FROM utilisateurs WHERE id = $1', [id]);
      if (!existingRows[0]) return res.status(404).json({ message: 'Utilisateur non trouvé' });

      if (email && email !== existingRows[0].email) {
        const dup = await pool.query('SELECT 1 FROM utilisateurs WHERE email = $1 AND id <> $2', [email, id]);
        if (dup.rowCount > 0) return res.status(409).json({ message: 'Email déjà utilisé par un autre compte' });
      }

      const sets = [];
      const params = [];
      let idx = 1;

      if (email !== undefined) { sets.push(`email = $${idx++}`); params.push(email); }
      if (mot_de_passe !== undefined) {
        const hashed = await bcrypt.hash(mot_de_passe, SALT_ROUNDS);
        sets.push(`mot_de_passe = $${idx++}`); params.push(hashed);
      }
      if (nom_complet !== undefined) { sets.push(`nom_complet = $${idx++}`); params.push(nom_complet); }
      if (telephone !== undefined) { sets.push(`telephone = $${idx++}`); params.push(telephone); }
      if (role !== undefined) { sets.push(`role = $${idx++}`); params.push(role); }
      if (statut !== undefined) { sets.push(`statut = $${idx++}`); params.push(statut); }
      if (photo_profil !== undefined) { sets.push(`photo_profil = $${idx++}`); params.push(photo_profil); }

      if (sets.length === 0) return res.status(400).json({ message: 'Aucun champ à mettre à jour' });

      const sql = `UPDATE utilisateurs SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, email, nom_complet, telephone, role, statut, photo_profil, date_creation, derniere_connexion`;
      params.push(id);
      const { rows } = await pool.query(sql, params);

      res.json({ utilisateur: sanitizeUser(rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:id',
  [param('id').isUUID().withMessage('id invalide')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { id } = req.params;
      const { rows } = await pool.query('DELETE FROM utilisateurs WHERE id = $1 RETURNING id', [id]);
      if (!rows[0]) return res.status(404).json({ message: 'Utilisateur non trouvé' });
      res.json({ message: 'Utilisateur supprimé', id: rows[0].id });
    } catch (err) {
      next(err);
    }
  }
);

// Upload photo de profil
router.post('/:id/photo', authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Autoriser l'utilisateur lui-même ou un admin
    if (req.user.user_id !== id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    if (!req.files || !req.files.image) {
      return res.status(400).json({ success: false, message: 'Image requise' });
    }
    const image = req.files.image;
    if (Array.isArray(image)) {
      return res.status(400).json({ success: false, message: 'Une seule image autorisée' });
    }

    const uploadDir = path.join(__dirname, '../uploads/profile');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const sanitize = (name) => name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${uuidv4()}_${Date.now()}_${sanitize(image.name || 'profile')}`;
    const filepath = path.join(uploadDir, filename);
    await image.mv(filepath);

    const publicPath = `/uploads/profile/${filename}`;
    await pool.query('UPDATE utilisateurs SET photo_profil = $1 WHERE id = $2', [publicPath, id]);

    return res.json({ success: true, photo_url: publicPath });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
