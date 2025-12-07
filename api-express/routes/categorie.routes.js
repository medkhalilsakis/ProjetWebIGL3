// routes/categorie.routes.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authMiddleware, checkRole } = require('../middleware/auth.middleware');

// GET all categories
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT DISTINCT categorie FROM produits ORDER BY categorie');

    return res.json({
      success: true,
      data: result.rows.map(row => ({ id: row.categorie, nom: row.categorie }))
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return res.status(500).json({ success: false, message: 'Error fetching categories' });
  }
});

// GET products by category
router.get('/:categorie/produits', async (req, res) => {
  try {
    const { categorie } = req.params;

    const result = await db.query(
      `SELECT * FROM produits 
       WHERE categorie = $1 AND disponible = true
       ORDER BY created_at DESC`,
      [categorie]
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
        image: p.image_principale,
        promotionPercent: p.prix_promotion ? Math.round((1 - p.prix_promotion / p.prix) * 100) : 0,
        fournisseur_id: p.fournisseur_id
      }))
    });
  } catch (error) {
    console.error('Error fetching category products:', error);
    return res.status(500).json({ success: false, message: 'Error fetching products' });
  }
});

module.exports = router;
