# LivraXpress - Route & Middleware Refactoring Plan
## Complete Code Examples & Implementation Details

**Created:** December 6, 2025  
**Version:** 1.0

---

## File 1: Enhanced Authentication Middleware
**Path:** `api-express/middleware/auth.middleware.js`

```javascript
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Enhanced Authentication Middleware
 * Validates session token and attaches user info to request
 * Supports multiple token sources: Bearer header, body, query param
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Extract token from multiple sources
    const token = extractTokenFromRequest(req);

    if (!token) {
      logger.warn('[AUTH] Token missing', { ip: req.ip, path: req.path });
      return res.status(401).json({
        success: false,
        code: 'AUTH_001',
        message: 'Authorization token required'
      });
    }

    // Query database for valid session
    const result = await db.query(
      `SELECT 
        s.token_session,
        s.utilisateur_id,
        s.adresse_ip,
        s.date_creation,
        s.date_expiration,
        u.id,
        u.role,
        u.email,
        u.nom_complet,
        u.telephone,
        u.statut,
        u.photo_profil,
        CASE 
          WHEN u.role = 'client' THEN c.id 
          WHEN u.role = 'supplier' THEN f.id
          WHEN u.role = 'driver' THEN l.id
          WHEN u.role = 'admin' THEN a.id
        END as profile_id
       FROM sessions_utilisateurs s
       JOIN utilisateurs u ON s.utilisateur_id = u.id
       LEFT JOIN clients c ON u.id = c.utilisateur_id
       LEFT JOIN fournisseurs f ON u.id = f.utilisateur_id
       LEFT JOIN livreurs l ON u.id = l.utilisateur_id
       LEFT JOIN admins a ON u.id = a.utilisateur_id
       WHERE s.token_session = $1 
         AND s.est_active = true
         AND s.date_expiration > CURRENT_TIMESTAMP
       LIMIT 1`,
      [token]
    );

    // Validate session exists
    if (!result || result.rows.length === 0) {
      logger.warn('[AUTH] Invalid or expired session', { token: token.substring(0, 10) });
      return res.status(401).json({
        success: false,
        code: 'AUTH_002',
        message: 'Session invalid or expired'
      });
    }

    const session = result.rows[0];

    // Check user status
    if (session.statut !== 'actif' && session.statut !== 'verifie') {
      logger.warn('[AUTH] User inactive', { user_id: session.id, status: session.statut });
      return res.status(403).json({
        success: false,
        code: 'AUTH_003',
        message: `Account is ${session.statut}. Contact support.`
      });
    }

    // Attach comprehensive user object to request
    req.user = {
      id: session.id,
      user_id: session.utilisateur_id, // Original utilisateur.id
      profile_id: session.profile_id,   // Role-specific profile ID
      role: session.role,
      email: session.email,
      nom_complet: session.nom_complet,
      telephone: session.telephone,
      statut: session.statut,
      photo_profil: session.photo_profil,
      token: token,
      session_created: session.date_creation,
      session_expires: session.date_expiration
    };

    logger.debug('[AUTH] User authenticated', { 
      user_id: req.user.id, 
      role: req.user.role 
    });

    next();
  } catch (error) {
    logger.error('[AUTH] Authentication error', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication service error'
    });
  }
};

/**
 * Extract token from multiple sources
 * Priority: Authorization header > body > query param
 */
const extractTokenFromRequest = (req) => {
  // 1. Try Authorization header (Bearer token)
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // 2. Try request body
  if (req.body?.session_token) {
    return req.body.session_token;
  }

  // 3. Try query parameter
  if (req.query?.session_token) {
    return req.query.session_token;
  }

  return null;
};

/**
 * Role-Based Authorization Middleware (Factory)
 * Usage: checkRole('client', 'supplier')
 */
const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_001',
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('[RBAC] Unauthorized role access', {
        user_id: req.user.id,
        user_role: req.user.role,
        required_roles: allowedRoles,
        path: req.path
      });

      return res.status(403).json({
        success: false,
        code: 'AUTH_003',
        message: `Access denied. Required role(s): ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Optional Authentication
 * Attaches user if authenticated, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) {
      return next();
    }

    const result = await db.query(
      `SELECT u.* FROM sessions_utilisateurs s
       JOIN utilisateurs u ON s.utilisateur_id = u.id
       WHERE s.token_session = $1 AND s.est_active = true
       LIMIT 1`,
      [token]
    );

    if (result.rows.length > 0) {
      req.user = {
        id: result.rows[0].id,
        role: result.rows[0].role,
        email: result.rows[0].email
      };
    }

    next();
  } catch (error) {
    next(); // Continue without user
  }
};

module.exports = {
  authMiddleware,
  checkRole,
  optionalAuth,
  extractTokenFromRequest
};
```

---

## File 2: Input Validation Middleware
**Path:** `api-express/middleware/validation.middleware.js`

```javascript
const { body, validationResult, param, query } = require('express-validator');

/**
 * Signup Validation
 */
const validateSignup = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format'),
  
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number'),
  
  body('role')
    .isIn(['client', 'supplier', 'driver', 'admin'])
    .withMessage('Invalid role'),
  
  body('nom_complet')
    .trim()
    .notEmpty()
    .isLength({ min: 3, max: 255 })
    .withMessage('Name must be 3-255 characters'),
  
  body('telephone')
    .isMobilePhone()
    .withMessage('Invalid phone number'),
  
  // Additional validation for supplier/driver signup
  body('type_fournisseur')
    .if(() => body('role').equals('supplier'))
    .isIn(['restaurant', 'supermarche', 'pharmacie', 'fleuriste', 'high_tech', 'autre'])
    .withMessage('Invalid supplier type'),
  
  // Validation handler
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        message: 'Validation error',
        errors: errors.array().map(err => ({
          field: err.param,
          message: err.msg
        }))
      });
    }
    next();
  }
];

/**
 * Login Validation
 */
const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }
    next();
  }
];

/**
 * Create Order Validation
 */
const validateCreateOrder = [
  body('fournisseur_id').isUUID().withMessage('Invalid supplier ID'),
  body('adresse_livraison_id').isUUID().withMessage('Invalid address ID'),
  body('produits')
    .isArray({ min: 1 })
    .withMessage('At least one product required'),
  body('produits.*.produit_id').isUUID(),
  body('produits.*.quantite').isInt({ min: 1 }),
  body('mode_paiement')
    .isIn(['especes', 'carte'])
    .withMessage('Invalid payment method'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        message: 'Invalid order data',
        errors: errors.array()
      });
    }
    next();
  }
];

/**
 * Create Product Validation
 */
const validateCreateProduct = [
  body('nom')
    .trim()
    .notEmpty()
    .isLength({ min: 2, max: 255 })
    .withMessage('Product name required (2-255 chars)'),
  
  body('prix')
    .isFloat({ min: 0.01 })
    .withMessage('Price must be greater than 0'),
  
  body('stock')
    .optional()
    .isInt({ min: -1 })
    .withMessage('Stock must be -1 (infinite) or positive'),
  
  body('description')
    .optional()
    .trim(),
  
  body('categorie_id')
    .isUUID()
    .withMessage('Invalid category ID'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        message: 'Product validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

/**
 * Update Product Validation
 */
const validateUpdateProduct = [
  body('nom')
    .optional()
    .trim()
    .isLength({ min: 2, max: 255 }),
  
  body('prix')
    .optional()
    .isFloat({ min: 0.01 }),
  
  body('stock')
    .optional()
    .isInt({ min: -1 }),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        errors: errors.array()
      });
    }
    next();
  }
];

/**
 * Update Order Status Validation
 */
const validateUpdateOrderStatus = [
  body('statut')
    .isIn(['en_preparation', 'pret_pour_livraison', 'en_livraison', 'livree', 'annulee'])
    .withMessage('Invalid order status'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        errors: errors.array()
      });
    }
    next();
  }
];

/**
 * Update Location Validation (for driver)
 */
const validateUpdateLocation = [
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        errors: errors.array()
      });
    }
    next();
  }
];

/**
 * ID Validation (UUID)
 */
const validateUUID = [
  param('id').isUUID().withMessage('Invalid ID format'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        errors: errors.array()
      });
    }
    next();
  }
];

module.exports = {
  validateSignup,
  validateLogin,
  validateCreateOrder,
  validateCreateProduct,
  validateUpdateProduct,
  validateUpdateOrderStatus,
  validateUpdateLocation,
  validateUUID
};
```

---

## File 3: Error Handling Middleware
**Path:** `api-express/middleware/error.middleware.js`

```javascript
const logger = require('../utils/logger');

/**
 * Centralized Error Handler
 * Should be registered as the last middleware in server.js
 */
const errorHandler = (err, req, res, next) => {
  logger.error('[ERROR]', err);

  // PostgreSQL errors
  if (err.code === '23505') {
    // UNIQUE constraint violation
    return res.status(409).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Resource already exists',
      detail: err.detail
    });
  }

  if (err.code === '23503') {
    // Foreign key violation
    return res.status(400).json({
      success: false,
      code: 'INVALID_REFERENCE',
      message: 'Referenced resource does not exist'
    });
  }

  if (err.code === '42703') {
    // Column not found
    return res.status(500).json({
      success: false,
      code: 'DATABASE_ERROR',
      message: 'Database schema error'
    });
  }

  if (err.code === '42P01') {
    // Table not found
    return res.status(500).json({
      success: false,
      code: 'DATABASE_ERROR',
      message: 'Database table error'
    });
  }

  // Custom application errors
  if (err.isValidationError) {
    return res.status(422).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: err.message,
      errors: err.errors
    });
  }

  if (err.isAuthError) {
    return res.status(401).json({
      success: false,
      code: err.code || 'AUTH_ERROR',
      message: err.message
    });
  }

  if (err.isAuthorizationError) {
    return res.status(403).json({
      success: false,
      code: 'AUTHORIZATION_ERROR',
      message: err.message
    });
  }

  if (err.isNotFoundError) {
    return res.status(404).json({
      success: false,
      code: 'NOT_FOUND',
      message: err.message
    });
  }

  // Multer file upload errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        code: 'FILE_TOO_LARGE',
        message: 'File size exceeds limit'
      });
    }
    if (err.code === 'FILE_TYPE_NOT_ALLOWED') {
      return res.status(415).json({
        success: false,
        code: 'INVALID_FILE_TYPE',
        message: 'File type not allowed'
      });
    }
  }

  // Default error
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    code: 'SERVER_ERROR',
    message: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

/**
 * 404 Not Found Handler
 * Register this before errorHandler
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: `Route not found: ${req.method} ${req.path}`
  });
};

module.exports = {
  errorHandler,
  notFoundHandler
};
```

---

## File 4: Audit Logging Middleware
**Path:** `api-express/middleware/audit.middleware.js`

```javascript
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Audit Logging Middleware
 * Logs all mutations (POST, PUT, PATCH, DELETE) for compliance
 */
const auditMiddleware = async (req, res, next) => {
  // Skip GET requests
  if (req.method === 'GET' || req.method === 'HEAD') {
    return next();
  }

  // Capture original response send
  const originalSend = res.send;

  res.send = function(data) {
    // Log if user is authenticated and response is successful
    if (req.user && res.statusCode < 400) {
      logAudit({
        utilisateur_id: req.user.user_id,
        action: `${req.method}_${req.baseUrl}`,
        endpoint: req.path,
        method: req.method,
        ip_adresse: req.ip,
        user_agent: req.get('user-agent'),
        request_body: sanitizeData(req.body),
        status: res.statusCode
      }).catch(err => logger.error('[AUDIT] Logging failed', err));
    }

    res.send = originalSend;
    return res.send(data);
  };

  next();
};

/**
 * Log audit trail to database
 */
const logAudit = async (auditData) => {
  try {
    await db.query(
      `INSERT INTO audit_utilisateurs 
       (utilisateur_id, action, ip_adresse, user_agent, date_action)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [
        auditData.utilisateur_id,
        auditData.action,
        auditData.ip_adresse,
        auditData.user_agent
      ]
    );
  } catch (error) {
    logger.error('[AUDIT] Failed to log audit trail', error);
  }
};

/**
 * Remove sensitive data from logged request body
 */
const sanitizeData = (data) => {
  if (!data) return null;

  const sanitized = { ...data };
  const sensitiveFields = ['password', 'credit_card', 'token', 'secret', 'api_key'];

  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return JSON.stringify(sanitized).substring(0, 500); // Limit size
};

module.exports = {
  auditMiddleware,
  logAudit
};
```

---

## File 5: Rate Limiting Middleware
**Path:** `api-express/middleware/rateLimit.middleware.js`

```javascript
const rateLimit = require('express-rate-limit');

/**
 * Global rate limiter
 * 100 requests per 15 minutes
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limit for public endpoints and GET requests
    return req.method === 'GET' || req.path.startsWith('/api/public');
  }
});

/**
 * Strict rate limiter for auth endpoints
 * 5 requests per 15 minutes
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many login attempts, please try again later'
  },
  skipSuccessfulRequests: true // Don't count successful attempts
});

/**
 * Public API rate limiter
 * 50 requests per 15 minutes
 */
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Public API rate limit exceeded'
  }
});

module.exports = {
  globalLimiter,
  authLimiter,
  publicLimiter
};
```

---

## File 6: Server Configuration
**Path:** `api-express/server.js` (Updated Structure)

```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const fileUpload = require('express-fileupload');
const path = require('path');

// Middleware
const { authMiddleware, checkRole } = require('./middleware/auth.middleware');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');
const { auditMiddleware } = require('./middleware/audit.middleware');
const { globalLimiter, authLimiter, publicLimiter } = require('./middleware/rateLimit.middleware');

// Routes
const authRoutes = require('./routes/auth.routes');
const clientRoutes = require('./routes/client.routes');
const supplierRoutes = require('./routes/supplier.routes');
const driverRoutes = require('./routes/driver.routes');
const adminRoutes = require('./routes/admin.routes');
const publicRoutes = require('./routes/public.routes');

// Shared routes
const sharedOrderRoutes = require('./routes/shared/orders.routes');
const sharedNotificationRoutes = require('./routes/shared/notifications.routes');
const sharedAddressRoutes = require('./routes/shared/addresses.routes');
const sharedReviewRoutes = require('./routes/shared/reviews.routes');
const sharedPaymentRoutes = require('./routes/shared/payments.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// SECURITY MIDDLEWARE
// ============================================
app.use(helmet());
app.use(compression());

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ============================================
// BODY PARSING & FILE UPLOAD
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  abortOnLimit: true,
  createParentPath: true
}));

// ============================================
// STATIC FILES
// ============================================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================
// RATE LIMITING
// ============================================
app.use(globalLimiter);

// ============================================
// AUDIT LOGGING
// ============================================
app.use(auditMiddleware);

// ============================================
// HEALTH CHECK (Public)
// ============================================
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'healthy', timestamp: new Date() });
});

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================
app.use('/api/public', publicLimiter, publicRoutes);

// ============================================
// AUTH ROUTES (Login/Signup - Public but rate limited)
// ============================================
app.use('/api/auth', authLimiter, authRoutes);

// ============================================
// PROTECTED ROUTES (Authentication required)
// ============================================

// CLIENT ROUTES (role: client)
app.use('/api/client',
  authMiddleware,
  checkRole('client'),
  clientRoutes
);

// SUPPLIER ROUTES (role: supplier)
app.use('/api/supplier',
  authMiddleware,
  checkRole('supplier'),
  supplierRoutes
);

// DRIVER ROUTES (role: driver)
app.use('/api/driver',
  authMiddleware,
  checkRole('driver'),
  driverRoutes
);

// ADMIN ROUTES (role: admin)
app.use('/api/admin',
  authMiddleware,
  checkRole('admin'),
  adminRoutes
);

// ============================================
// SHARED ROUTES (Multi-role - Authentication required)
// ============================================
app.use('/api/shared/orders',
  authMiddleware,
  sharedOrderRoutes
);

app.use('/api/shared/notifications',
  authMiddleware,
  sharedNotificationRoutes
);

app.use('/api/shared/addresses',
  authMiddleware,
  sharedAddressRoutes
);

app.use('/api/shared/reviews',
  authMiddleware,
  sharedReviewRoutes
);

app.use('/api/shared/payments',
  authMiddleware,
  sharedPaymentRoutes
);

// ============================================
// ERROR HANDLING
// ============================================

// 404 Handler (before error handler)
app.use(notFoundHandler);

// Global Error Handler (last middleware)
app.use(errorHandler);

// ============================================
// SERVER STARTUP
// ============================================
app.listen(PORT, () => {
  console.log(`✅ Server started on port ${PORT}`);
  console.log(`🗄️  PostgreSQL connected`);
  console.log(`🌐 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:4200'}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  process.exit(0);
});
```

---

## File 7: Example Route - Client Dashboard
**Path:** `api-express/routes/client.routes.js`

```javascript
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { validateUUID, validateCreateOrder } = require('../middleware/validation.middleware');

/**
 * GET /api/client/dashboard
 * Get client dashboard overview
 */
router.get('/dashboard', async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    // Get client profile
    const clientRes = await db.query(
      'SELECT * FROM clients WHERE utilisateur_id = $1',
      [userId]
    );

    if (!clientRes.rows.length) {
      return res.status(404).json({
        success: false,
        code: 'USER_NOT_FOUND',
        message: 'Client profile not found'
      });
    }

    const clientId = clientRes.rows[0].id;

    // Get current orders (in progress)
    const ordersRes = await db.query(
      `SELECT c.*, f.nom_entreprise, l.utilisateur_id as driver_user_id
       FROM commandes c
       LEFT JOIN fournisseurs f ON c.fournisseur_id = f.id
       LEFT JOIN livreurs l ON c.livreur_id = l.id
       WHERE c.client_id = $1 
         AND c.statut IN ('en_attente', 'en_preparation', 'pret_pour_livraison', 'en_livraison')
       ORDER BY c.date_commande DESC
       LIMIT 5`,
      [clientId]
    );

    // Get recent orders
    const recentRes = await db.query(
      `SELECT c.*, f.nom_entreprise, c.statut
       FROM commandes c
       LEFT JOIN fournisseurs f ON c.fournisseur_id = f.id
       WHERE c.client_id = $1 
         AND c.statut IN ('livree', 'annulee')
       ORDER BY c.date_commande DESC
       LIMIT 5`,
      [clientId]
    );

    // Get favorites
    const favRes = await db.query(
      `SELECT f.*, u.nom_complet, u.photo_profil, AVG(a.note_fournisseur) as avg_rating
       FROM favoris fav
       JOIN fournisseurs f ON fav.fournisseur_id = f.id
       JOIN utilisateurs u ON f.utilisateur_id = u.id
       LEFT JOIN avis a ON f.id = a.fournisseur_id
       WHERE fav.client_id = $1
       GROUP BY f.id, u.id
       LIMIT 5`,
      [clientId]
    );

    // Get notifications
    const notifRes = await db.query(
      `SELECT * FROM notifications
       WHERE utilisateur_id = $1 AND lu = false
       ORDER BY date_creation DESC
       LIMIT 10`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        profile: clientRes.rows[0],
        current_orders: ordersRes.rows,
        recent_orders: recentRes.rows,
        favorites: favRes.rows,
        unread_notifications: notifRes.rows,
        notification_count: notifRes.rows.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/client/orders
 * List all client orders with filtering
 */
router.get('/orders', async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { status, limit = 20, offset = 0 } = req.query;

    const clientRes = await db.query(
      'SELECT id FROM clients WHERE utilisateur_id = $1',
      [userId]
    );

    if (!clientRes.rows.length) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const clientId = clientRes.rows[0].id;

    let query = 'SELECT c.*, f.nom_entreprise FROM commandes c LEFT JOIN fournisseurs f ON c.fournisseur_id = f.id WHERE c.client_id = $1';
    const params = [clientId];
    let paramCount = 2;

    if (status) {
      query += ` AND c.statut = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    query += ` ORDER BY c.date_commande DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: { limit, offset, total: result.rows.length }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/client/orders
 * Create new order
 */
router.post('/orders', validateCreateOrder, async (req, res, next) => {
  const client = await db.getClient();

  try {
    const userId = req.user.user_id;
    const { fournisseur_id, adresse_livraison_id, produits, mode_paiement, instructions_speciales } = req.body;

    // Get client ID
    const clientRes = await db.query(
      'SELECT id FROM clients WHERE utilisateur_id = $1',
      [userId]
    );

    if (!clientRes.rows.length) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const clientId = clientRes.rows[0].id;

    await client.query('BEGIN');

    // Create order
    const { v4: uuidv4 } = require('uuid');
    const orderId = uuidv4();

    // Calculate total
    let totalAmount = 0;
    for (const item of produits) {
      const prodRes = await client.query(
        'SELECT prix, stock FROM produits WHERE id = $1',
        [item.produit_id]
      );

      if (!prodRes.rows.length) {
        throw new Error(`Product ${item.produit_id} not found`);
      }

      const prod = prodRes.rows[0];

      if (prod.stock !== -1 && prod.stock < item.quantite) {
        throw new Error(`Insufficient stock for product ${item.produit_id}`);
      }

      totalAmount += prod.prix * item.quantite;
    }

    // Add service and delivery fees
    const servicefee = totalAmount * 0.05; // 5%
    const deliveryFee = 50; // Fixed for now

    const result = await client.query(
      `INSERT INTO commandes (id, client_id, fournisseur_id, adresse_livraison_id, montant_total, frais_service, frais_livraison, instructions_speciales, mode_paiement, statut)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'en_attente')
       RETURNING *`,
      [orderId, clientId, fournisseur_id, adresse_livraison_id, totalAmount + serviceFee + deliveryFee, serviceFee, deliveryFee, instructions_speciales, mode_paiement]
    );

    // Create line items
    for (const item of produits) {
      await client.query(
        `INSERT INTO lignes_commande (id, commande_id, produit_id, quantite, options_selectionnees)
         VALUES ($1, $2, $3, $4, $5)`,
        [uuidv4(), orderId, item.produit_id, item.quantite, item.options || {}]
      );
    }

    // Create payment record
    await client.query(
      `INSERT INTO paiements (id, commande_id, montant, mode_paiement, statut)
       VALUES ($1, $2, $3, $4, 'en_attente')`,
      [uuidv4(), orderId, totalAmount + serviceFee + deliveryFee, mode_paiement]
    );

    // Send notification to supplier
    await client.query(
      `INSERT INTO notifications (utilisateur_id, titre, message, type, lien_action)
       SELECT utilisateur_id, 'Nouvelle commande', $2, 'commande', $3
       FROM fournisseurs WHERE id = $1`,
      [fournisseur_id, `New order ${orderId.substring(0, 8)}`, `/supplier/orders/${orderId}`]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * GET /api/client/addresses
 * List client addresses
 */
router.get('/addresses', async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    const result = await db.query(
      `SELECT a.* FROM adresses a
       JOIN client_adresses ca ON a.id = ca.adresse_id
       JOIN clients c ON ca.client_id = c.id
       WHERE c.utilisateur_id = $1
       ORDER BY ca.est_principale DESC, a.date_creation DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/client/addresses
 * Add new address
 */
router.post('/addresses', async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { rue, complement, code_postal, ville, pays = 'Algérie', coordonnees_gps, libelle } = req.body;

    const { v4: uuidv4 } = require('uuid');
    const addressId = uuidv4();

    const addrRes = await db.query(
      `INSERT INTO adresses (id, rue, complement, code_postal, ville, pays, coordonnees_gps)
       VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7, $8), 4326))
       RETURNING *`,
      [addressId, rue, complement, code_postal, ville, pays, coordonnees_gps?.longitude, coordonnees_gps?.latitude]
    );

    // Link to client
    const clientRes = await db.query(
      'SELECT id FROM clients WHERE utilisateur_id = $1',
      [userId]
    );

    if (clientRes.rows.length) {
      await db.query(
        `INSERT INTO client_adresses (client_id, adresse_id, libelle)
         VALUES ($1, $2, $3)`,
        [clientRes.rows[0].id, addressId, libelle]
      );
    }

    res.status(201).json({
      success: true,
      data: addrRes.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
```

---

## Summary of Changes

### Key Improvements

1. **Middleware Stack**
   - ✅ Comprehensive authentication with multiple token sources
   - ✅ Role-based authorization (RBAC)
   - ✅ Input validation using express-validator
   - ✅ Centralized error handling
   - ✅ Audit logging for compliance
   - ✅ Rate limiting to prevent abuse

2. **Route Structure**
   - ✅ Clear separation by role (client, supplier, driver, admin)
   - ✅ Shared routes for multi-role functionality
   - ✅ Public routes for browsing (no auth required)
   - ✅ Consistent naming conventions

3. **Error Handling**
   - ✅ Custom error codes (AUTH_001, ORDER_001, etc.)
   - ✅ PostgreSQL error handling
   - ✅ Consistent error response format
   - ✅ Development vs production error details

4. **Security**
   - ✅ CORS configuration
   - ✅ Helmet for security headers
   - ✅ Password requirements validation
   - ✅ Sensitive data redaction in logs
   - ✅ Rate limiting on auth endpoints
   - ✅ Session expiration handling

5. **Database**
   - ✅ Transactional operations (BEGIN/COMMIT/ROLLBACK)
   - ✅ PostGIS support for geolocation
   - ✅ Proper foreign key constraints
   - ✅ Audit trail logging

### Next Steps

1. Create the route files for each role
2. Implement the controllers for each endpoint
3. Create service layer for business logic
4. Add WebSocket support for real-time updates
5. Integrate with payment gateway
6. Setup file upload handlers
7. Implement notification service
8. Add integration tests

**Document Version:** 1.0  
**Status:** Ready for Implementation  
**Last Updated:** December 6, 2025
