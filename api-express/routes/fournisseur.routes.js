const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { authMiddleware, checkRole } = require('../middleware/auth.middleware');

// Protect all routes - user must be authenticated and have 'fournisseur' role
router.use(authMiddleware);
router.use(checkRole('fournisseur'));

// Helper to get fournisseur_id from utilisateur_id
async function getFournisseurId(utilisateur_id) {
  try {
    const res = await db.query('SELECT id FROM fournisseurs WHERE utilisateur_id = $1 LIMIT 1', [utilisateur_id]);
    return res && res.rows.length > 0 ? res.rows[0].id : null;
  } catch (err) {
    console.error('Error getting fournisseur_id:', err);
    return null;
  }
}

// Helper to ensure default categories exist
async function ensureDefaultCategories() {
  try {
    const defaultCategories = [
      'Alimentation',
      'Électronique',
      'Vêtements',
      'Livres',
      'Jouets',
      'Sports',
      'Autres'
    ];

    for (const catName of defaultCategories) {
      const exists = await db.query(
        `SELECT id FROM categories WHERE LOWER(nom) = LOWER($1) LIMIT 1`,
        [catName]
      );

      if (!exists?.rows?.length) {
        const catId = uuidv4();
        await db.query(
          `INSERT INTO categories (id, nom) VALUES ($1, $2)`,
          [catId, catName]
        ).catch((e) => {
          // ignore race conditions where another process created the category
          if (e.code !== '23505') console.error('Error inserting default category:', e);
        });
      }
    }
  } catch (err) {
    console.error('Error ensuring default categories:', err);
  }
}

// Initialize default categories on first load (fire-and-forget)
ensureDefaultCategories();

/**
 * GET /fournisseur/stats
 * Get dashboard statistics for the authenticated supplier
 */
router.get('/stats', async (req, res) => {
  try {
    const fournisseur_id = await getFournisseurId(req.user.user_id);
    if (!fournisseur_id) {
      return res.status(200).json({
        success: true,
        data: {
          ordersToday: 0,
          ordersWeek: 0,
          ordersMonth: 0,
          revenueToday: 0,
          revenueWeek: 0,
          revenueMonth: 0,
          rating: 0,
          avgPrepTime: 0,
          totalOrders: 0
        }
      });
    }

    // Build date boundaries (JS Date objects — PG will accept them via parameterized query)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Orders today
    const ordersToday = await db.query(
      `SELECT COUNT(*) as count FROM commandes WHERE fournisseur_id = $1 AND DATE(date_commande) = DATE($2)`,
      [fournisseur_id, today]
    );

    // Orders this week
    const ordersWeek = await db.query(
      `SELECT COUNT(*) as count FROM commandes WHERE fournisseur_id = $1 AND date_commande >= $2`,
      [fournisseur_id, weekStart]
    );

    // Orders this month
    const ordersMonth = await db.query(
      `SELECT COUNT(*) as count FROM commandes WHERE fournisseur_id = $1 AND date_commande >= $2`,
      [fournisseur_id, monthStart]
    );

    // Revenue today
    const revenueToday = await db.query(
      `SELECT COALESCE(SUM(montant_total), 0) as total FROM commandes WHERE fournisseur_id = $1 AND DATE(date_commande) = DATE($2)`,
      [fournisseur_id, today]
    );

    // Revenue this week
    const revenueWeek = await db.query(
      `SELECT COALESCE(SUM(montant_total), 0) as total FROM commandes WHERE fournisseur_id = $1 AND date_commande >= $2`,
      [fournisseur_id, weekStart]
    );

    // Revenue this month
    const revenueMonth = await db.query(
      `SELECT COALESCE(SUM(montant_total), 0) as total FROM commandes WHERE fournisseur_id = $1 AND date_commande >= $2`,
      [fournisseur_id, monthStart]
    );

    // Supplier info for rating and prep time
    const supplierInfo = await db.query(
      `SELECT note_moyenne, temps_preparation_moyen FROM fournisseurs WHERE id = $1 LIMIT 1`,
      [fournisseur_id]
    );

    // Total orders ever
    const totalOrders = await db.query(
      `SELECT COUNT(*) as count FROM commandes WHERE fournisseur_id = $1`,
      [fournisseur_id]
    );

    res.status(200).json({
      success: true,
      data: {
        ordersToday: parseInt(ordersToday.rows[0]?.count, 10) || 0,
        ordersWeek: parseInt(ordersWeek.rows[0]?.count, 10) || 0,
        ordersMonth: parseInt(ordersMonth.rows[0]?.count, 10) || 0,
        revenueToday: parseFloat(revenueToday.rows[0]?.total) || 0,
        revenueWeek: parseFloat(revenueWeek.rows[0]?.total) || 0,
        revenueMonth: parseFloat(revenueMonth.rows[0]?.total) || 0,
        rating: parseFloat(supplierInfo.rows[0]?.note_moyenne) || 0,
        avgPrepTime: parseInt(supplierInfo.rows[0]?.temps_preparation_moyen, 10) || 0,
        totalOrders: parseInt(totalOrders.rows[0]?.count, 10) || 0
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(200).json({
      success: true,
      data: {
        ordersToday: 0,
        ordersWeek: 0,
        ordersMonth: 0,
        revenueToday: 0,
        revenueWeek: 0,
        revenueMonth: 0,
        rating: 0,
        avgPrepTime: 0,
        totalOrders: 0
      }
    });
  }
});

/**
 * GET /fournisseur/produits
 * Get all products for the authenticated supplier
 */
router.get('/produits', async (req, res) => {
  try {
    const fournisseur_id = await getFournisseurId(req.user.user_id);
    if (!fournisseur_id) {
      return res.status(200).json({ success: true, data: [] });
    }

    const result = await db.query(
      `SELECT id, nom, description, prix, prix_promotion, image_principale, images_additionnelles, stock, disponible, categorie_id
       FROM produits
       WHERE fournisseur_id = $1
       ORDER BY id DESC`,
      [fournisseur_id]
    );

    res.status(200).json({
      success: true,
      data: (result.rows || []).map(row => {
        const prix = row.prix != null ? parseFloat(row.prix) : null;
        const prixPromo = row.prix_promotion != null ? parseFloat(row.prix_promotion) : null;
        const promotionPercent = (prix && prixPromo && prix > 0) ? Math.round((1 - prixPromo / prix) * 100) : 0;

        return {
          id: row.id,
          nom: row.nom,
          description: row.description,
          prix: prix,
          prix_promotion: prixPromo,
          quantite: row.stock,
          status: row.disponible ? 'active' : 'out_of_stock',
          categorie_id: row.categorie_id || null,
          image: row.image_principale || null,
          promotionPercent
        };
      })
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(200).json({ success: true, data: [] });
  }
});

/**
 * POST /fournisseur/upload-images
 * Upload product images (main and additional)
 * Files: image_principale (required), images_additionnelles[] (optional)
 * Note: requires middleware such as express-fileupload or multer configured in app.js
 */
router.post('/upload-images', async (req, res) => {
  try {
    const uploadDir = path.join(__dirname, '../uploads/products');

    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const uploadedImages = { mainImage: null, additionalImages: [] };

    // Handle main image (mandatory)
    if (!req.files || !req.files.image_principale) {
      return res.status(400).json({ success: false, message: 'Main image is required' });
    }

    const mainImage = req.files.image_principale;
    if (Array.isArray(mainImage)) {
      return res.status(400).json({ success: false, message: 'Only one main image allowed' });
    }

    const sanitize = (name) => name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const mainFilename = `${uuidv4()}_${Date.now()}_${sanitize(mainImage.name || 'main')}`;
    const mainPath = path.join(uploadDir, mainFilename);
    await mainImage.mv(mainPath);
    uploadedImages.mainImage = `/uploads/products/${mainFilename}`;

    // Handle additional images (optional) - support either key 'images_additionnelles' or array key
    let additionalImages = req.files['images_additionnelles'] || req.files['images_additionnelles[]'] || [];
    if (additionalImages && !Array.isArray(additionalImages)) additionalImages = [additionalImages];

    for (const img of additionalImages) {
      if (uploadedImages.additionalImages.length >= 5) break;
      const filename = `${uuidv4()}_${Date.now()}_${sanitize(img.name || 'add')}`;
      const filepath = path.join(uploadDir, filename);
      await img.mv(filepath);
      uploadedImages.additionalImages.push(`/uploads/products/${filename}`);
    }

    res.status(200).json({ success: true, data: uploadedImages });
  } catch (error) {
    console.error('Error uploading images:', error);
    res.status(500).json({ success: false, message: 'Error uploading images' });
  }
});

/**
 * POST /fournisseur/produits
 * Create a new product
 */
router.post('/produits', async (req, res) => {
  try {
    const fournisseur_id = await getFournisseurId(req.user.user_id);
    if (!fournisseur_id) return res.status(404).json({ success: false, message: 'Fournisseur non trouvé' });

    const {
      nom,
      description = '',
      prix,
      quantite,
      categorie_id,
      image = null
    } = req.body;

    if (!nom?.trim()) return res.status(400).json({ success: false, message: 'Le nom du produit est obligatoire' });
    const prixNum = prix != null ? parseFloat(prix) : null;
    if (!prixNum || prixNum <= 0) return res.status(400).json({ success: false, message: 'Le prix doit être positif' });
    const quant = quantite !== undefined ? parseInt(quantite, 10) : 0;
    if (quant < 0) return res.status(400).json({ success: false, message: 'La quantité doit être ≥ 0' });
    if (!categorie_id) return res.status(400).json({ success: false, message: 'La catégorie est obligatoire' });

    const produitId = uuidv4();

    const result = await db.query(
      `INSERT INTO produits
       (id, fournisseur_id, nom, description, prix, stock, disponible, categorie_id, image_principale)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8)
       RETURNING id, nom, prix, stock, categorie_id`,
      [produitId, fournisseur_id, nom.trim(), description.trim(), prixNum, quant, categorie_id, image]
    );

    res.status(201).json({ success: true, message: 'Produit ajouté avec succès', data: result.rows[0] });
  } catch (error) {
    console.error('Error creating product:', error);
    if (error.code === '23503') {
      return res.status(400).json({ success: false, message: 'Catégorie invalide. Vérifiez que l\'ID existe.' });
    }
    res.status(500).json({ success: false, message: 'Erreur lors de l\'ajout du produit', details: error.message });
  }
});

/**
 * PUT /fournisseur/produits/:id
 * Update a product
 */
router.put('/produits/:id', async (req, res) => {
  try {
    const fournisseur_id = await getFournisseurId(req.user.user_id);
    if (!fournisseur_id) return res.status(404).json({ success: false, message: 'Fournisseur not found' });

    const product_id = req.params.id;
    const { nom, description, prix, quantite, status, categorie_id, promotionPercent } = req.body;

    // Verify product belongs to this supplier
    const verify = await db.query(`SELECT id FROM produits WHERE id = $1 AND fournisseur_id = $2`, [product_id, fournisseur_id]);
    if (verify.rows.length === 0) return res.status(404).json({ success: false, message: 'Product not found' });

    const prixNum = prix != null ? parseFloat(prix) : null;
    let prixPromotion = null;
    if (prixNum != null && promotionPercent != null) {
      const pct = parseFloat(promotionPercent);
      if (!isNaN(pct) && pct > 0 && pct < 100) {
        prixPromotion = (prixNum * (100 - pct)) / 100;
        // sécurité : éviter prix_promotion égal ou supérieur au prix de base
        if (prixPromotion >= prixNum) prixPromotion = prixNum * 0.99;
      } else {
        prixPromotion = null;
      }
    }

    const disponible = typeof status !== 'undefined' ? (status !== 'out_of_stock') : null;
    const stock = typeof quantite !== 'undefined' ? parseInt(quantite, 10) : null;

    const result = await db.query(
      `UPDATE produits
       SET nom = COALESCE($1, nom),
           description = COALESCE($2, description),
           prix = COALESCE($3, prix),
           prix_promotion = $4,
           stock = COALESCE($5, stock),
           disponible = COALESCE($6, disponible),
           categorie_id = COALESCE($9, categorie_id)
       WHERE id = $7 AND fournisseur_id = $8
       RETURNING *`,
      [nom || null, description || null, prixNum || null, prixPromotion, stock, disponible, product_id, fournisseur_id, categorie_id || null]
    );

    const updated = result.rows[0];
    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: {
        id: updated.id,
        nom: updated.nom,
        description: updated.description,
        prix: updated.prix != null ? parseFloat(updated.prix) : null,
        quantite: updated.stock,
        status: updated.disponible ? 'active' : 'out_of_stock',
        categorie_id: updated.categorie_id || null,
        image: updated.image_principale || null,
        promotionPercent: promotionPercent || 0
      }
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, message: 'Error updating product' });
  }
});

/**
 * DELETE /fournisseur/produits/:id
 * Delete a product
 */
router.delete('/produits/:id', async (req, res) => {
  try {
    const fournisseur_id = await getFournisseurId(req.user.user_id);
    if (!fournisseur_id) return res.status(404).json({ success: false, message: 'Fournisseur not found' });

    const product_id = req.params.id;

    const result = await db.query(`DELETE FROM produits WHERE id = $1 AND fournisseur_id = $2 RETURNING id`, [product_id, fournisseur_id]);

    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Product not found' });

    res.status(200).json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, message: 'Error deleting product' });
  }
});

/**
 * PATCH /fournisseur/produits/:id
 * Toggle product status (active/inactive)
 */
router.patch('/produits/:id', async (req, res) => {
  try {
    const fournisseur_id = await getFournisseurId(req.user.user_id);
    if (!fournisseur_id) return res.status(404).json({ success: false, message: 'Fournisseur not found' });

    const product_id = req.params.id;

    // Get current disponible status and toggle it (ensure supplier owns it)
    const current = await db.query(`SELECT disponible FROM produits WHERE id = $1 AND fournisseur_id = $2`, [product_id, fournisseur_id]);
    if (current.rows.length === 0) return res.status(404).json({ success: false, message: 'Product not found' });

    const newAvailability = !current.rows[0].disponible;

    const result = await db.query(`UPDATE produits SET disponible = $1, updated_at = NOW() WHERE id = $2 AND fournisseur_id = $3 RETURNING *`, [newAvailability, product_id, fournisseur_id]);

    res.status(200).json({
      success: true,
      message: 'Product status updated',
      data: {
        id: result.rows[0].id,
        nom: result.rows[0].nom,
        status: newAvailability ? 'active' : 'inactive'
      }
    });
  } catch (error) {
    console.error('Error updating product status:', error);
    res.status(500).json({ success: false, message: 'Error updating product status' });
  }
});

/**
 * GET /fournisseur/commandes
 * Get supplier's orders with optional limit
 */
router.get('/commandes', async (req, res) => {
  try {
    const fournisseur_id = await getFournisseurId(req.user.user_id);
    if (!fournisseur_id) return res.status(200).json({ success: true, data: [] });

    const limit = Math.min(1000, parseInt(req.query.limit, 10) || 50);

    const result = await db.query(
      `SELECT c.*, u.nom_complet as client_nom
       FROM commandes c
       LEFT JOIN utilisateurs u ON c.client_id = u.id
       WHERE c.fournisseur_id = $1
       ORDER BY c.date_commande DESC
       LIMIT $2`,
      [fournisseur_id, limit]
    );

    res.status(200).json({
      success: true,
      data: (result.rows || []).map(row => ({
        id: row.id,
        numero_suivi: (row.id || '').substring(0, 8).toUpperCase(),
        statut: row.statut || 'en_attente',
        montant_total: row.montant_total != null ? parseFloat(row.montant_total) : 0,
        client_nom: row.client_nom || 'Unknown',
        lignes_commande: [],
        instructions_speciales: row.instructions_speciales || null,
        created_at: row.date_commande,
        estimated_pickup: row.estimated_pickup || null
      }))
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(200).json({ success: true, data: [] });
  }
});

/**
 * PATCH /fournisseur/commandes/:id
 * Update order status
 */
router.patch('/commandes/:id', async (req, res) => {
  try {
    const fournisseur_id = await getFournisseurId(req.user.user_id);
    if (!fournisseur_id) return res.status(404).json({ success: false, message: 'Fournisseur not found' });

    const order_id = req.params.id;
    const { statut } = req.body;

    if (!statut) return res.status(400).json({ success: false, message: 'Status is required' });

    // Verify order belongs to this supplier
    const verify = await db.query(`SELECT id FROM commandes WHERE id = $1 AND fournisseur_id = $2`, [order_id, fournisseur_id]);
    if (verify.rows.length === 0) return res.status(404).json({ success: false, message: 'Order not found' });

    const result = await db.query(`UPDATE commandes SET statut = $1, updated_at = NOW() WHERE id = $2 AND fournisseur_id = $3 RETURNING *`, [statut, order_id, fournisseur_id]);

    res.status(200).json({ success: true, message: 'Order status updated', data: result.rows[0] });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, message: 'Error updating order status' });
  }
});

/**
 * POST /fournisseur/commandes/:id/notifier-courrier
 * Notify courier for pickup
 */
router.post('/commandes/:id/notifier-courrier', async (req, res) => {
  try {
    const order_id = req.params.id;
    // TODO: Implement notification logic (websocket, push, external API)
    res.status(200).json({ success: true, message: 'Courier notified successfully' });
  } catch (error) {
    console.error('Error notifying courier:', error);
    res.status(500).json({ success: false, message: 'Error notifying courier' });
  }
});

/**
 * GET /fournisseur/alertes
 * Get alerts for the supplier
 */
router.get('/alertes', async (req, res) => {
  try {
    const fournisseur_id = await getFournisseurId(req.user.user_id);
    if (!fournisseur_id) return res.status(200).json({ success: true, data: [] });

    // Get low stock alerts
    const lowStock = await db.query(
      `SELECT id, 'stock' as type, 'Low stock: ' || nom as message, 'warning' as severity, NOW() as timestamp
       FROM produits
       WHERE fournisseur_id = $1 AND stock < 10`,
      [fournisseur_id]
    );

    res.status(200).json({ success: true, data: lowStock.rows || [] });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(200).json({ success: true, data: [] });
  }
});

/**
 * GET /fournisseur/finance
 * Get finance information for the supplier
 */
router.get('/finance', async (req, res) => {
  try {
    const fournisseur_id = await getFournisseurId(req.user.user_id);
    if (!fournisseur_id) return res.status(200).json({ success: true, data: { availableBalance: 0, totalCommission: 0, paymentHistory: [] } });

    // TODO: Add solde_disponible and commission_total columns to fournisseurs table and link paiements to fournisseurs
    const financeInfo = { rows: [{ solde_disponible: 0, commission_total: 0 }] };
    const paymentHistory = [];

    res.status(200).json({
      success: true,
      data: {
        availableBalance: financeInfo.rows[0]?.solde_disponible || 0,
        totalCommission: financeInfo.rows[0]?.commission_total || 0,
        paymentHistory: paymentHistory || []
      }
    });
  } catch (error) {
    console.error('Error fetching finance data:', error);
    res.status(200).json({ success: true, data: { availableBalance: 0, totalCommission: 0, paymentHistory: [] } });
  }
});

/**
 * POST /fournisseur/payout
 * Request a payout
 */
router.post('/payout', async (req, res) => {
  try {
    const fournisseur_id = await getFournisseurId(req.user.user_id);
    if (!fournisseur_id) return res.status(404).json({ success: false, message: 'Fournisseur not found' });

    const { montant } = req.body;
    const montantNum = montant != null ? parseFloat(montant) : null;
    if (!montantNum || montantNum <= 0) return res.status(400).json({ success: false, message: 'Valid amount is required' });

    const payoutId = uuidv4();
    const result = await db.query(
      `INSERT INTO paiements (id, montant, mode_paiement, statut, created_at)
       VALUES ($1, $2, 'payout', 'pending', NOW())
       RETURNING *`,
      [payoutId, montantNum]
    );

    res.status(201).json({ success: true, message: 'Payout request submitted', data: result.rows[0] });
  } catch (error) {
    console.error('Error requesting payout:', error);
    res.status(500).json({ success: false, message: 'Error requesting payout' });
  }
});

/**
 * GET /fournisseur/produits/top
 * Get top performing products
 */
router.get('/produits/top', async (req, res) => {
  try {
    const fournisseur_id = await getFournisseurId(req.user.user_id);
    if (!fournisseur_id) return res.status(200).json({ success: true, data: [] });

    const result = await db.query(
      `SELECT p.id, p.nom, COALESCE(COUNT(lc.id),0) as sales
       FROM produits p
       LEFT JOIN lignes_commande lc ON p.id = lc.produit_id
       LEFT JOIN commandes c ON lc.commande_id = c.id AND c.fournisseur_id = $1
       WHERE p.fournisseur_id = $1
       GROUP BY p.id, p.nom
       ORDER BY sales DESC
       LIMIT 10`,
      [fournisseur_id]
    );

    res.status(200).json({
      success: true,
      data: (result.rows || []).map(row => ({
        id: row.id,
        name: row.nom,
        sales: parseInt(row.sales, 10) || 0,
        trend: 'up'
      }))
    });
  } catch (error) {
    console.error('Error fetching top products:', error);
    res.status(200).json({ success: true, data: [] });
  }
});

/**
 * POST /fournisseur/schedule
 * Update store schedule
 */
router.post('/schedule', async (req, res) => {
  try {
    const fournisseur_id = await getFournisseurId(req.user.user_id);
    if (!fournisseur_id) return res.status(404).json({ success: false, message: 'Fournisseur not found' });

    const { openingTime, closingTime } = req.body;
    // TODO: Persist schedule to DB (e.g. table opening_hours)
    res.status(200).json({ success: true, message: 'Schedule updated successfully' });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ success: false, message: 'Error updating schedule' });
  }
});

/**
 * POST /fournisseur/availability
 * Toggle store availability
 */
router.post('/availability', async (req, res) => {
  try {
    const fournisseur_id = await getFournisseurId(req.user.user_id);
    if (!fournisseur_id) return res.status(404).json({ success: false, message: 'Fournisseur not found' });

    const { isOpen } = req.body;
    // TODO: Persist availability to fournisseurs table (e.g. column is_open)
    res.status(200).json({ success: true, message: 'Availability updated successfully', data: { isOpen } });
  } catch (error) {
    console.error('Error updating availability:', error);
    res.status(500).json({ success: false, message: 'Error updating availability' });
  }
});

module.exports = router;
