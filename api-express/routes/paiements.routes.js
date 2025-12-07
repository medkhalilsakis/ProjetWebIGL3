// routes/paiements.routes.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');

// GET payments for user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.* FROM paiements p
       JOIN commandes c ON p.commande_id = c.id
       JOIN clients cl ON c.client_id = cl.id
       WHERE cl.utilisateur_id = $1
       ORDER BY p.created_at DESC`,
      [req.user.user_id]
    );

    return res.json({
      success: true,
      data: result.rows.map(payment => ({
        id: payment.id,
        commande_id: payment.commande_id,
        montant: payment.montant,
        mode_paiement: payment.mode_paiement,
        statut: payment.statut,
        date: payment.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return res.status(500).json({ success: false, message: 'Error fetching payments' });
  }
});

// GET payment by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT p.* FROM paiements p
       JOIN commandes c ON p.commande_id = c.id
       JOIN clients cl ON c.client_id = cl.id
       WHERE p.id = $1 AND cl.utilisateur_id = $2`,
      [id, req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const payment = result.rows[0];
    return res.json({
      success: true,
      data: {
        id: payment.id,
        commande_id: payment.commande_id,
        montant: payment.montant,
        mode_paiement: payment.mode_paiement,
        statut: payment.statut,
        date: payment.created_at
      }
    });
  } catch (error) {
    console.error('Error fetching payment:', error);
    return res.status(500).json({ success: false, message: 'Error fetching payment' });
  }
});

// POST process payment
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { commande_id, montant, mode_paiement } = req.body;

    const paiementId = uuidv4();
    await db.query(
      `INSERT INTO paiements (id, commande_id, montant, mode_paiement, statut, created_at)
       VALUES ($1, $2, $3, $4, 'en_attente', now())`,
      [paiementId, commande_id, montant, mode_paiement]
    );

    return res.status(201).json({
      success: true,
      message: 'Payment created',
      data: { id: paiementId }
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    return res.status(500).json({ success: false, message: 'Error creating payment' });
  }
});

// PATCH confirm payment
router.patch('/:id/confirmer', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      `UPDATE paiements 
       SET statut = 'confirme', updated_at = now()
       WHERE id = $1`,
      [id]
    );

    // Update corresponding order status
    const paymentResult = await db.query(
      'SELECT commande_id FROM paiements WHERE id = $1',
      [id]
    );

    if (paymentResult.rows.length > 0) {
      await db.query(
        'UPDATE commandes SET statut = \'confirmee\' WHERE id = $1',
        [paymentResult.rows[0].commande_id]
      );
    }

    return res.json({ success: true, message: 'Payment confirmed' });
  } catch (error) {
    console.error('Error confirming payment:', error);
    return res.status(500).json({ success: false, message: 'Error confirming payment' });
  }
});

module.exports = router;
