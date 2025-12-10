// routes/avis.routes.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');

// GET reviews for a product
router.get('/produit/:produit_id', async (req, res) => {
  try {
    const { produit_id } = req.params;

    const result = await db.query(
      `SELECT a.id, a.note, a.contenu, a.date_avis AS created_at, u.nom_complet 
       FROM avis a
       JOIN clients c ON a.client_id = c.id
       JOIN utilisateurs u ON c.utilisateur_id = u.id
        WHERE a.produit_id = $1
        ORDER BY a.date_avis DESC`,
      [produit_id]
    );

    return res.json({
      success: true,
      data: result.rows.map(review => ({
        id: review.id,
        rating: review.note,
        comment: review.contenu,
        author: review.nom_complet,
        date: review.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return res.status(500).json({ success: false, message: 'Error fetching reviews' });
  }
});

// GET reviews for the authenticated fournisseur
router.get('/fournisseur', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'fournisseur') return res.status(403).json({ success: false, message: 'Accès refusé' });

    const fRes = await db.query('SELECT id FROM fournisseurs WHERE utilisateur_id = $1 LIMIT 1', [req.user.user_id]);
    if (!fRes || fRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Fournisseur introuvable' });

    const fournisseur_id = fRes.rows[0].id;

    const result = await db.query(
      `SELECT a.*, a.date_avis AS created_at, u.nom_complet 
       FROM avis a
       JOIN commandes c ON a.commande_id = c.id
       JOIN clients cl ON c.client_id = cl.id
       JOIN utilisateurs u ON cl.utilisateur_id = u.id
        WHERE c.fournisseur_id = $1
        ORDER BY a.date_avis DESC`,
      [fournisseur_id]
    );

    return res.json({
      success: true,
      data: result.rows.map(review => ({
        id: review.id,
        rating: review.note,
        comment: review.contenu,
        author: review.nom_complet,
        date: review.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching supplier reviews (auth):', error);
    return res.status(500).json({ success: false, message: 'Error fetching reviews' });
  }
});

// GET reviews for a supplier by ID
router.get('/fournisseur/:fournisseur_id', async (req, res) => {
  try {
    const { fournisseur_id } = req.params;

    const result = await db.query(
      `SELECT a.id, a.note, a.contenu, a.date_avis AS created_at, u.nom_complet 
       FROM avis a
       JOIN commandes c ON a.commande_id = c.id
       JOIN clients cl ON c.client_id = cl.id
       JOIN utilisateurs u ON cl.utilisateur_id = u.id
        WHERE c.fournisseur_id = $1
        ORDER BY a.date_avis DESC`,
      [fournisseur_id]
    );

    return res.json({
      success: true,
      data: result.rows.map(review => ({
        id: review.id,
        rating: review.note,
        comment: review.contenu,
        author: review.nom_complet,
        date: review.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching supplier reviews:', error);
    return res.status(500).json({ success: false, message: 'Error fetching reviews' });
  }
});

// POST create review
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { produit_id, commande_id, note, contenu } = req.body;

    // Vérifier client existant
    const clientResult = await db.query('SELECT id FROM clients WHERE utilisateur_id = $1 LIMIT 1', [req.user.user_id]);
    if (clientResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Client not found' });

    // Validation minimale de la note
    const rating = Number(note);
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Note invalide (0-5)' });
    }

    // (Optionnel recommandé) vérifier que le client a bien une commande/ligne correspondante avant de poster un avis.
    const avisId = uuidv4();
    await db.query(
      `INSERT INTO avis (id, client_id, produit_id, commande_id, note, contenu, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [avisId, clientResult.rows[0].id, produit_id || null, commande_id || null, rating, contenu || null]
    );

    return res.status(201).json({ success: true, message: 'Review created', data: { id: avisId } });
  } catch (error) {
    console.error('Error creating review:', error);
    return res.status(500).json({ success: false, message: 'Error creating review' });
  }
});

module.exports = router;
