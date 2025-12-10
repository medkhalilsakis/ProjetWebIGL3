const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * GET all categories (public)
 * Retourne les catégories actives, ordonnées par ordre_affichage puis nom.
 */
router.get('/', async (req, res) => {
  try {
    const sql = `
      SELECT id, nom, slug, image_url, is_featured, ordre_affichage, created_at
      FROM public.categories
      WHERE COALESCE(actif, true) = true
      ORDER BY ordre_affichage ASC NULLS LAST, nom ASC
    `;
    const result = await db.query(sql);

    const data = result.rows.map(c => ({
      id: c.id,
      name: c.nom,
      slug: c.slug || null,
      image: c.image_url || null,
      featured: !!c.is_featured,
      createdAt: c.created_at
    }));

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return res.status(500).json({ success: false, message: 'Error fetching categories' });
  }
});

/**
 * GET products by category ID (public)
 * Param: categorie_id (string/uuid text)
 */
router.get('/:categorie_id/produits', async (req, res) => {
  try {
    const { categorie_id } = req.params;

    const sql = `
      SELECT id, nom, description, prix, prix_promotion, stock, quantite, disponible,
             image_principale, image_url AS produit_image_url, fournisseur_id, created_at
      FROM public.produits
      WHERE categorie_id = $1
        AND COALESCE(disponible, false) = true
      ORDER BY created_at DESC
    `;
    const result = await db.query(sql, [categorie_id]);

    const data = result.rows.map(p => {
      // pg returns numeric as string; safe parse
      const prix = p.prix != null ? parseFloat(p.prix) : null;
      const prixPromotion = p.prix_promotion != null ? parseFloat(p.prix_promotion) : null;

      let promotionPercent = 0;
      if (prix && prixPromotion && prix > 0) {
        promotionPercent = Math.round((1 - prixPromotion / prix) * 100);
        if (promotionPercent < 0) promotionPercent = 0;
      }

      // prefer image_principale, fallback to produit_image_url
      const image = p.image_principale || p.produit_image_url || null;

      // prefer field 'stock' then 'quantite'
      const quantite = (typeof p.stock !== 'undefined' && p.stock !== null)
        ? p.stock
        : (typeof p.quantite !== 'undefined' ? p.quantite : null);

      return {
        id: p.id,
        name: p.nom,
        description: p.description,
        price: prix,
        promotionalPrice: prixPromotion,
        quantity: quantite,
        status: p.disponible ? 'active' : 'inactive',
        image,
        promotionPercent,
        fournisseurId: p.fournisseur_id,
        createdAt: p.created_at
      };
    });

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching category products:', error);
    return res.status(500).json({ success: false, message: 'Error fetching products' });
  }
});

module.exports = router;
