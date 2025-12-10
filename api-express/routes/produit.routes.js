// routes/produit.routes.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');

function addParam(params, value) {
  params.push(value);
  return `$${params.length}`;
}

router.get('/', async (req, res) => {
  try {
    const { fournisseur_id, categorie_id, search } = req.query;
    let limit = parseInt(req.query.limit, 10) || 50;
    let offset = parseInt(req.query.offset, 10) || 0;
    if (limit < 1) limit = 1;
    if (limit > 200) limit = 200;
    if (offset < 0) offset = 0;

    let query = 'SELECT * FROM produits WHERE COALESCE(disponible, false) = true';
    const params = [];

    if (fournisseur_id) {
      query += ` AND fournisseur_id = ${addParam(params, fournisseur_id)}`;
    }

    if (categorie_id) {
      query += ` AND categorie_id = ${addParam(params, categorie_id)}`;
    }

    if (search) {
      const like = `%${search}%`;
      query += ` AND (nom ILIKE ${addParam(params, like)} OR description ILIKE ${addParam(params, like)})`;
    }

    query += ` ORDER BY id DESC LIMIT ${addParam(params, limit)} OFFSET ${addParam(params, offset)}`;

    const result = await db.query(query, params);

    return res.json({
      success: true,
      message: 'Products retrieved successfully',
      data: result.rows.map(p => {
        const prix = p.prix != null ? parseFloat(p.prix) : null;
        const prixPromo = p.prix_promotion != null ? parseFloat(p.prix_promotion) : null;
        const promotionPercent = (prix && prixPromo && prix > 0) ? Math.round((1 - prixPromo / prix) * 100) : 0;

        return {
          id: p.id,
          nom: p.nom,
          description: p.description,
          prix,
          quantite: p.stock,
          status: p.disponible ? 'active' : 'inactive',
          categorie_id: p.categorie_id || null,
          image: p.image_principale || p.image_url || null,
          promotionPercent,
          fournisseur_id: p.fournisseur_id,
          prix_promotion: prixPromo,
        };
      })
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ success: false, message: 'Error fetching products', error: error.message });
  }
});

// GET by id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM produits WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Product not found' });
    const p = result.rows[0];
    const prix = p.prix != null ? parseFloat(p.prix) : null;
    const prixPromo = p.prix_promotion != null ? parseFloat(p.prix_promotion) : null;
    const promotionPercent = (prix && prixPromo && prix > 0) ? Math.round((1 - prixPromo / prix) * 100) : 0;

    return res.json({
      success: true,
      data: {
        id: p.id,
        nom: p.nom,
        description: p.description,
        prix,
        quantite: p.stock,
        status: p.disponible ? 'active' : 'inactive',
        categorie_id: p.categorie_id || null,
        image: p.image_principale || p.image_url || null,
        promotionPercent,
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
    const result = await db.query('SELECT * FROM produits WHERE fournisseur_id = $1 ORDER BY id DESC', [fournisseur_id]);
    return res.json({
      success: true,
      data: result.rows.map(p => {
        const prix = p.prix != null ? parseFloat(p.prix) : null;
        const prixPromo = p.prix_promotion != null ? parseFloat(p.prix_promotion) : null;
        const promotionPercent = (prix && prixPromo && prix > 0) ? Math.round((1 - prixPromo / prix) * 100) : 0;
        return {
          id: p.id,
          nom: p.nom,
          description: p.description,
          prix,
          quantite: p.stock,
          status: p.disponible ? 'active' : 'inactive',
          categorie_id: p.categorie_id || null,
          image: p.image_principale || p.image_url || null,
          promotionPercent
        };
      })
    });
  } catch (error) {
    console.error('Error fetching supplier products:', error);
    return res.status(500).json({ success: false, message: 'Error fetching products' });
  }
});

module.exports = router;
