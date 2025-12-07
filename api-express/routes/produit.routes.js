// routes/produit.routes.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authMiddleware, checkRole } = require('../middleware/auth.middleware');

// GET all products (Public)
router.get('/', async (req, res) => {
  try {
    const { fournisseur_id, categorie, search, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM produits WHERE disponible = true';
    const params = [];
    let paramCount = 1;

    if (fournisseur_id) {
      query += ` AND fournisseur_id = $${paramCount++}`;
      params.push(fournisseur_id);
    }

    if (categorie) {
      query += ` AND categorie = $${paramCount++}`;
      params.push(categorie);
    }

    if (search) {
      query += ` AND (nom ILIKE $${paramCount++} OR description ILIKE $${paramCount})`;
      params.push(`%${search}%`, `%${search}%`);
      paramCount += 2;
    }

    query += ` ORDER BY id DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    return res.json({
      success: true,
      message: 'Products retrieved successfully',
      data: result.rows.map(p => ({
        id: p.id,
        nom: p.nom,
        description: p.description,
        prix: p.prix,
        quantite: p.stock,
        status: p.disponible ? 'active' : 'inactive',
        categorie: p.categorie,
        image: p.image_principale,
        promotionPercent: p.prix_promotion ? Math.round((1 - p.prix_promotion / p.prix) * 100) : 0,
        fournisseur_id: p.fournisseur_id,
        created_at: p.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ success: false, message: 'Error fetching products', error: error.message });
  }
});

// GET product by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM produits WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const p = result.rows[0];
    return res.json({
      success: true,
      data: {
        id: p.id,
        nom: p.nom,
        description: p.description,
        prix: p.prix,
        quantite: p.stock,
        status: p.disponible ? 'active' : 'inactive',
        categorie: p.categorie,
        image: p.image_principale,
        promotionPercent: p.prix_promotion ? Math.round((1 - p.prix_promotion / p.prix) * 100) : 0,
        fournisseur_id: p.fournisseur_id,
        created_at: p.created_at,
        updated_at: p.updated_at
      }
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    return res.status(500).json({ success: false, message: 'Error fetching product' });
  }
});

// GET products by supplier
router.get('/supplier/:fournisseur_id', async (req, res) => {
  try {
    const { fournisseur_id } = req.params;
    const result = await db.query(
      'SELECT * FROM produits WHERE fournisseur_id = $1 ORDER BY created_at DESC',
      [fournisseur_id]
    );

    return res.json({
      success: true,
      data: result.rows.map(p => ({
        id: p.id,
        nom: p.nom,
        description: p.description,
        prix: p.prix,
        quantite: p.stock,
        status: p.disponible ? 'active' : 'inactive',
        categorie: p.categorie,
        image: p.image_principale,
        promotionPercent: p.prix_promotion ? Math.round((1 - p.prix_promotion / p.prix) * 100) : 0
      }))
    });
  } catch (error) {
    console.error('Error fetching supplier products:', error);
    return res.status(500).json({ success: false, message: 'Error fetching products' });
  }
});

module.exports = router;
