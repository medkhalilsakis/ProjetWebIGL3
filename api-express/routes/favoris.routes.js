// routes/favoris.routes.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');

// GET user favorites
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.* FROM produits p
       JOIN favoris f ON p.id = f.produit_id
       JOIN clients c ON f.client_id = c.id
       WHERE c.utilisateur_id = $1
       ORDER BY f.created_at DESC`,
      [req.user.user_id]
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
        categorie_id: p.categorie_id || p.categorie,
        image: p.image_principale,
        promotionPercent: p.prix_promotion ? Math.round((1 - p.prix_promotion / p.prix) * 100) : 0,
        fournisseur_id: p.fournisseur_id
      }))
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return res.status(500).json({ success: false, message: 'Error fetching favorites' });
  }
});

// POST add to favorites
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { produit_id } = req.body;

    const clientResult = await db.query('SELECT id FROM clients WHERE utilisateur_id = $1 LIMIT 1', [req.user.user_id]);
    if (clientResult.rowCount === 0) return res.status(404).json({ success: false, message: 'Client not found' });
    const clientId = clientResult.rows[0].id;

    const exists = await db.query('SELECT 1 FROM favoris WHERE client_id = $1 AND produit_id = $2 LIMIT 1', [clientId, produit_id]);
    if (exists.rowCount > 0) return res.status(409).json({ success: false, message: 'Product already in favorites' });

    await db.query('INSERT INTO favoris (id, client_id, produit_id, created_at) VALUES ($1, $2, $3, NOW())', [uuidv4(), clientId, produit_id]);

    return res.status(201).json({ success: true, message: 'Added to favorites' });
  } catch (error) {
    console.error('Error adding to favorites:', error);
    return res.status(500).json({ success: false, message: 'Error adding to favorites' });
  }
});

// DELETE from favorites
router.delete('/:produit_id', authMiddleware, async (req, res) => {
  try {
    const { produit_id } = req.params;

    const clientResult = await db.query('SELECT id FROM clients WHERE utilisateur_id = $1 LIMIT 1', [req.user.user_id]);
    if (clientResult.rowCount === 0) return res.status(404).json({ success: false, message: 'Client not found' });

    const deleteRes = await db.query('DELETE FROM favoris WHERE client_id = $1 AND produit_id = $2 RETURNING id', [clientResult.rows[0].id, produit_id]);
    if (deleteRes.rowCount === 0) return res.status(404).json({ success: false, message: 'Favorite not found' });

    return res.json({ success: true, message: 'Removed from favorites' });
  } catch (error) {
    console.error('Error removing from favorites:', error);
    return res.status(500).json({ success: false, message: 'Error removing from favorites' });
  }
});

module.exports = router;
