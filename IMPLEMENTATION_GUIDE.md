# LivraXpress Platform - Implementation Guide
## Multi-User Delivery Platform Architecture

**Date:** December 6, 2025  
**Version:** 1.0  
**Platform:** Node.js/Express + Angular + PostgreSQL + PostGIS

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [User Roles & Permissions](#user-roles--permissions)
3. [Authentication Flow](#authentication-flow)
4. [Middleware Stack](#middleware-stack)
5. [Route Structure](#route-structure)
6. [Dashboard Specifications](#dashboard-specifications)
7. [API Endpoints Matrix](#api-endpoints-matrix)
8. [Error Handling Strategy](#error-handling-strategy)
9. [Data Validation Rules](#data-validation-rules)
10. [Implementation Checklist](#implementation-checklist)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                      LIVRAEXPRESS PLATFORM                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  FRONTEND (Angular 18+)                                           │
│  ├─ Accueil (Landing)                                            │
│  ├─ Authentication (Login/Signup)                                │
│  └─ Role-Based Dashboards                                        │
│      ├─ Client Dashboard                                         │
│      ├─ Supplier Dashboard                                       │
│      ├─ Driver Dashboard                                         │
│      └─ Admin Dashboard                                          │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  BACKEND (Express.js)                                             │
│  ├─ Authentication Service (JWT + Sessions)                      │
│  ├─ Role-Based Access Control (RBAC)                             │
│  ├─ API Routes (v1)                                              │
│  │   ├─ /api/auth (Public)                                       │
│  │   ├─ /api/client (Protected, role: client)                    │
│  │   ├─ /api/supplier (Protected, role: supplier)                │
│  │   ├─ /api/driver (Protected, role: driver)                    │
│  │   ├─ /api/admin (Protected, role: admin)                      │
│  │   └─ /api/shared (Protected, multi-role)                      │
│  └─ Middleware Stack                                             │
│      ├─ Authentication                                           │
│      ├─ Authorization (RBAC)                                     │
│      ├─ Validation                                               │
│      ├─ Error Handling                                           │
│      └─ Logging/Audit                                            │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  DATABASE (PostgreSQL + PostGIS)                                  │
│  ├─ Users & Sessions                                             │
│  ├─ Role-Specific Tables                                         │
│  ├─ Products & Catalog                                           │
│  ├─ Orders & Transactions                                        │
│  ├─ Notifications & Messaging                                    │
│  ├─ Geographic Data (PostGIS)                                    │
│  └─ Analytics & Reporting                                        │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│  EXTERNAL SERVICES                                                │
│  ├─ Maps API (Google Maps / Mapbox)                              │
│  ├─ Payment Gateway (Stripe / Local Payment)                     │
│  ├─ Email Service (SendGrid / NodeMailer)                        │
│  ├─ SMS/Push Notifications (Firebase / Twilio)                   │
│  └─ File Storage (AWS S3 / Local Storage)                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## User Roles & Permissions

### 1. Client (Customer)
**Can:**
- Browse suppliers and products
- Place orders
- Track deliveries in real-time
- Manage delivery addresses
- View order history
- Leave reviews and ratings
- Manage payment methods
- Use promotional codes
- Chat with support

**Cannot:**
- Add products
- See other customers' orders
- Approve deliveries
- Modify supplier info

**Database Table:** `clients`

---

### 2. Supplier (Merchant/Vendor)
**Can:**
- Add, edit, delete products
- Manage inventory/stock
- Set pricing and promotions
- View orders received
- Accept/reject orders
- Update order status
- View revenue analytics
- Manage delivery zones
- Track driver ratings
- Respond to customer reviews

**Cannot:**
- Deliver orders
- Access customer data
- Manage other suppliers' products
- Access admin functions

**Database Table:** `fournisseurs`

---

### 3. Driver (Delivery Personnel)
**Can:**
- View available deliveries
- Accept/decline delivery requests
- Update real-time GPS location
- Update order status
- Upload proof of delivery
- View earnings/statistics
- Rate customers
- Manage availability status
- Update profile and documents

**Cannot:**
- Create orders
- Modify product pricing
- Access customer contact info (only delivery address)
- Manage other drivers' deliveries

**Database Table:** `livreurs`

---

### 4. Admin
**Can:**
- Access all dashboards (read-only or full)
- Approve/reject supplier applications
- Suspend/activate users
- View platform analytics
- Generate reports
- Manage support tickets
- Configure system settings
- View financial reports
- Manage promotions
- Access audit logs

**Cannot:**
- Place orders (unless also customer)
- Deliver packages (unless also driver)
- Modify pricing (outside configurations)

**Database Table:** `admins`

---

## Authentication Flow

### Registration Flow

```
CLIENT REQUEST
    ↓
POST /api/auth/signup
    ├─ Validate Input (email, password, role, name, phone)
    ├─ Check Email Uniqueness
    ├─ Hash Password (bcrypt)
    ├─ BEGIN TRANSACTION
    │   ├─ INSERT INTO utilisateurs
    │   ├─ INSERT INTO {clients|fournisseurs|livreurs} (based on role)
    │   └─ COMMIT
    ├─ Generate Session Token (UUID)
    ├─ INSERT INTO sessions_utilisateurs
    └─ RESPONSE { success, user, token, message }
```

### Login Flow

```
CLIENT REQUEST
    ↓
POST /api/auth/login
    ├─ Validate Input (email, password)
    ├─ Query utilisateurs (email)
    ├─ Verify Password (bcrypt.compare)
    ├─ Generate Session Token (UUID)
    ├─ INSERT INTO sessions_utilisateurs
    │   ├─ Set Expiration (7 days default)
    │   ├─ Store IP & User-Agent
    │   └─ Mark as Active
    ├─ UPDATE utilisateurs.derniere_connexion
    └─ RESPONSE { success, user, token, dashboard_url }
```

### Session Validation (Every Protected Request)

```
REQUEST HEADERS: Authorization: Bearer {token}
    ↓
authMiddleware (async)
    ├─ Extract Token from Header
    ├─ Query sessions_utilisateurs
    ├─ Verify:
    │   ├─ Token exists
    │   ├─ est_active = true
    │   ├─ date_expiration > NOW()
    │   └─ JOIN utilisateurs
    ├─ Attach req.user = { id, role, email, nom_complet, ... }
    ├─ Call next() if valid
    └─ Return 401 if invalid
```

### Logout Flow

```
DELETE /api/auth/logout (Authenticated)
    ├─ Update sessions_utilisateurs
    │   ├─ SET est_active = false
    │   └─ WHERE token_session = {token}
    └─ RESPONSE { success, message: "Logged out" }
```

---

## Middleware Stack

### 1. Authentication Middleware (`authMiddleware`)

**Purpose:** Validate user session and attach user info to request

**Location:** `api-express/middleware/auth.middleware.js`

```javascript
// Structure:
const authMiddleware = async (req, res, next) => {
  try {
    // 1. Extract token from multiple sources
    const token = extractTokenFromRequest(req);
    
    // 2. Validate token exists
    if (!token) return res.status(401).json({ 
      success: false, 
      message: 'Authorization header missing' 
    });
    
    // 3. Query database
    const result = await db.query(
      `SELECT s.*, u.id, u.role, u.email, u.nom_complet, u.statut
       FROM sessions_utilisateurs s
       JOIN utilisateurs u ON s.utilisateur_id = u.id
       WHERE s.token_session = $1 
         AND s.est_active = true
         AND s.date_expiration > CURRENT_TIMESTAMP`,
      [token]
    );
    
    // 4. Validate result
    if (!result.rows.length) return res.status(401).json({
      success: false,
      message: 'Session invalid or expired'
    });
    
    // 5. Attach to request
    req.user = {
      id: result.rows[0].id,
      role: result.rows[0].role,
      email: result.rows[0].email,
      nom_complet: result.rows[0].nom_complet,
      statut: result.rows[0].statut,
      session_token: token
    };
    
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};
```

---

### 2. Role-Based Authorization Middleware (`checkRole`)

**Purpose:** Verify user has required role(s)

**Location:** `api-express/middleware/auth.middleware.js`

```javascript
// Structure:
const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
      });
    }
    
    next();
  };
};

// Usage:
router.get('/dashboard', 
  authMiddleware, 
  checkRole('client', 'supplier', 'driver'),
  dashboardController
);
```

---

### 3. Input Validation Middleware (`validateInput`)

**Purpose:** Validate and sanitize request data

**Location:** `api-express/middleware/validation.middleware.js`

```javascript
const { body, validationResult } = require('express-validator');

// Signup validation
const validateSignup = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('role').isIn(['client', 'supplier', 'driver', 'admin']),
  body('nom_complet').trim().notEmpty(),
  body('telephone').isMobilePhone(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  }
];

// Usage:
router.post('/signup', validateSignup, authController.signup);
```

---

### 4. Error Handling Middleware

**Purpose:** Centralized error response formatting

**Location:** `api-express/middleware/error.middleware.js`

```javascript
const errorHandler = (err, req, res, next) => {
  console.error('[ERROR]', err);
  
  // Define error types
  if (err.code === 'UNIQUE_VIOLATION') {
    return res.status(409).json({
      success: false,
      message: 'Resource already exists',
      error: err.detail
    });
  }
  
  if (err.code === '42703') { // Column not found
    return res.status(500).json({
      success: false,
      message: 'Database schema error'
    });
  }
  
  // Default error
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
};
```

---

### 5. Audit Logging Middleware

**Purpose:** Log all user actions for compliance

**Location:** `api-express/middleware/audit.middleware.js`

```javascript
const auditMiddleware = async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    if (req.user && req.method !== 'GET') {
      // Log to audit_utilisateurs table
      logAudit({
        utilisateur_id: req.user.id,
        action: 'api_call',
        endpoint: req.path,
        method: req.method,
        ip_adresse: req.ip,
        user_agent: req.get('user-agent'),
        status: res.statusCode
      });
    }
    res.send = originalSend;
    return res.send(data);
  };
  
  next();
};
```

---

## Route Structure

### Directory Organization

```
api-express/
├── routes/
│   ├── auth.routes.js           (Public: signup, login, logout)
│   ├── client.routes.js         (Protected: client operations)
│   ├── supplier.routes.js       (Protected: supplier operations)
│   ├── driver.routes.js         (Protected: driver operations)
│   ├── admin.routes.js          (Protected: admin operations)
│   ├── shared/
│   │   ├── orders.routes.js     (Multi-role: order operations)
│   │   ├── notifications.routes.js (Multi-role: notifications)
│   │   ├── addresses.routes.js  (Multi-role: address management)
│   │   ├── reviews.routes.js    (Multi-role: ratings)
│   │   └── payments.routes.js   (Multi-role: payments)
│   └── public/
│       ├── products.routes.js   (Public: browse products)
│       ├── suppliers.routes.js  (Public: browse suppliers)
│       └── search.routes.js     (Public: search)
│
├── controllers/
│   ├── auth.controller.js
│   ├── client.controller.js
│   ├── supplier.controller.js
│   ├── driver.controller.js
│   ├── admin.controller.js
│   └── shared/
│       ├── orders.controller.js
│       ├── notifications.controller.js
│       ├── addresses.controller.js
│       ├── reviews.controller.js
│       └── payments.controller.js
│
├── middleware/
│   ├── auth.middleware.js       (Authentication & Authorization)
│   ├── validation.middleware.js (Input validation)
│   ├── error.middleware.js      (Error handling)
│   ├── audit.middleware.js      (Audit logging)
│   └── rateLimit.middleware.js  (Rate limiting)
│
├── services/
│   ├── auth.service.js
│   ├── user.service.js
│   ├── order.service.js
│   ├── notification.service.js
│   ├── payment.service.js
│   ├── geolocation.service.js
│   └── email.service.js
│
└── utils/
    ├── database.js
    ├── constants.js
    └── validators.js
```

---

### Route Definitions

#### Authentication Routes (Public)

```javascript
// POST /api/auth/signup
// POST /api/auth/login
// POST /api/auth/logout (Protected)
// POST /api/auth/refresh-token (Protected)
// POST /api/auth/forgot-password
// POST /api/auth/reset-password
// GET  /api/auth/verify-email/:token
```

#### Client Routes (Protected: role = 'client')

```javascript
// GET    /api/client/dashboard
// GET    /api/client/orders
// GET    /api/client/orders/:id
// POST   /api/client/orders
// PATCH  /api/client/orders/:id/cancel
// GET    /api/client/profile
// PATCH  /api/client/profile
// GET    /api/client/addresses
// POST   /api/client/addresses
// DELETE /api/client/addresses/:id
// GET    /api/client/favorites
// POST   /api/client/favorites/:supplier_id
// DELETE /api/client/favorites/:supplier_id
// GET    /api/client/payment-methods
// POST   /api/client/payment-methods
// DELETE /api/client/payment-methods/:id
// GET    /api/client/notifications
// PATCH  /api/client/notifications/:id/read
// GET    /api/client/promotions
// POST   /api/client/redeem-promo
```

#### Supplier Routes (Protected: role = 'supplier')

```javascript
// GET    /api/supplier/dashboard
// GET    /api/supplier/profile
// PATCH  /api/supplier/profile
// GET    /api/supplier/products
// POST   /api/supplier/products
// PATCH  /api/supplier/products/:id
// DELETE /api/supplier/products/:id
// GET    /api/supplier/inventory
// PATCH  /api/supplier/products/:id/stock
// GET    /api/supplier/orders
// GET    /api/supplier/orders/:id
// PATCH  /api/supplier/orders/:id/status
// GET    /api/supplier/revenue
// GET    /api/supplier/zones
// POST   /api/supplier/zones
// PATCH  /api/supplier/zones/:id
// DELETE /api/supplier/zones/:id
// GET    /api/supplier/reviews
// POST   /api/supplier/reviews/:id/respond
// GET    /api/supplier/settings
// PATCH  /api/supplier/settings
```

#### Driver Routes (Protected: role = 'driver')

```javascript
// GET    /api/driver/dashboard
// GET    /api/driver/profile
// PATCH  /api/driver/profile
// GET    /api/driver/documents
// POST   /api/driver/documents (upload)
// GET    /api/driver/deliveries/available
// GET    /api/driver/deliveries/active
// GET    /api/driver/deliveries/history
// POST   /api/driver/deliveries/:id/accept
// POST   /api/driver/deliveries/:id/decline
// PATCH  /api/driver/deliveries/:id/status
// POST   /api/driver/deliveries/:id/location (GPS)
// POST   /api/driver/deliveries/:id/complete
// GET    /api/driver/earnings
// GET    /api/driver/statistics
// PATCH  /api/driver/availability
// GET    /api/driver/notifications
// GET    /api/driver/ratings
```

#### Admin Routes (Protected: role = 'admin')

```javascript
// GET    /api/admin/dashboard
// GET    /api/admin/users
// PATCH  /api/admin/users/:id/status
// GET    /api/admin/suppliers/pending
// PATCH  /api/admin/suppliers/:id/approve
// PATCH  /api/admin/suppliers/:id/reject
// GET    /api/admin/orders
// GET    /api/admin/orders/analytics
// GET    /api/admin/revenue
// GET    /api/admin/drivers
// PATCH  /api/admin/drivers/:id/suspend
// GET    /api/admin/support/tickets
// POST   /api/admin/support/tickets/:id/resolve
// GET    /api/admin/analytics
// GET    /api/admin/settings
// PATCH  /api/admin/settings
```

#### Shared Routes (Protected: Multi-role)

```javascript
// GET    /api/shared/notifications
// PATCH  /api/shared/notifications/:id/read
// DELETE /api/shared/notifications/:id
// GET    /api/shared/profile
// PATCH  /api/shared/profile
// GET    /api/shared/addresses
// POST   /api/shared/addresses
// DELETE /api/shared/addresses/:id
// POST   /api/shared/reviews (client reviews supplier/driver)
// GET    /api/shared/reviews/:id
// POST   /api/shared/payments/verify
// GET    /api/shared/support/chat
// POST   /api/shared/support/message
```

#### Public Routes (No Authentication Required)

```javascript
// GET    /api/public/suppliers
// GET    /api/public/suppliers/:id
// GET    /api/public/suppliers/:id/products
// GET    /api/public/products
// GET    /api/public/products/:id
// GET    /api/public/categories
// GET    /api/public/search?q={query}
// GET    /api/public/promotions
```

---

## Dashboard Specifications

### 1. Client Dashboard

**URL:** `/client/dashboard`  
**Components:**

- **Header**
  - User name & profile picture
  - Notifications bell
  - Account menu (profile, addresses, payment methods, logout)

- **Quick Actions**
  - Search suppliers/products
  - Recent orders quick reorder
  - Favorite suppliers

- **Current Orders Section**
  - Active orders with real-time tracking
  - Driver location on map
  - Estimated arrival time
  - Order status timeline
  - Live chat with driver/supplier

- **New Order Placement**
  - Category selector
  - Supplier/product search
  - Browse suppliers nearby
  - Add to cart
  - Checkout (select address, payment method, promo code)

- **Order History**
  - Paginated list
  - Filter by date, supplier, status
  - View invoice/receipt
  - Quick reorder button

- **Notifications Section**
  - Order confirmations
  - Status updates
  - Driver assignments
  - Messages
  - Promotions

- **Payment Methods**
  - Saved cards
  - Add new card
  - Wallet balance (if applicable)

- **Promotions**
  - Available offers
  - Apply promo codes
  - Referral program (if any)

- **Support**
  - Chat with support
  - FAQ section
  - Contact information

---

### 2. Supplier Dashboard

**URL:** `/supplier/dashboard`  
**Components:**

- **Header**
  - Business name
  - Verification status
  - Notifications
  - Account menu

- **Dashboard Overview**
  - Today's orders count
  - Today's revenue
  - Pending orders
  - Average rating

- **Orders Management**
  - Incoming orders (new)
  - Preparing (in progress)
  - Ready for pickup
  - Delivered
  - Order details with items
  - Accept/reject order
  - Update status
  - Estimated prep time

- **Products Management**
  - Product list with images
  - Edit/delete product
  - Add new product
  - Category organization
  - Stock management
  - Set pricing & promotions
  - View product analytics

- **Inventory**
  - Stock levels
  - Low stock alerts
  - Restock history

- **Revenue Analytics**
  - Total revenue (today, week, month)
  - Revenue chart
  - Commission breakdown
  - Payment history
  - Request payout

- **Delivery Zones**
  - Define service areas
  - Set zone-specific fees
  - Manage delivery radius

- **Reviews & Ratings**
  - Customer reviews
  - Rating breakdown (1-5 stars)
  - Respond to reviews
  - View detailed feedback

- **Settings**
  - Business info (name, description, hours)
  - Profile picture & cover
  - Delivery settings
  - Notification preferences
  - Bank account info for payouts

---

### 3. Driver Dashboard

**URL:** `/driver/dashboard`  
**Components:**

- **Header**
  - Driver name
  - Availability status toggle (Online/Offline)
  - Real-time location
  - Notifications

- **Current Deliveries**
  - Map view of active deliveries
  - Route optimization
  - Next delivery highlighted
  - Customer address with direction link (Google Maps)
  - Delivery instructions
  - Customer contact info
  - Order details
  - Mark as arrived / delivered
  - Upload proof of delivery (photo/signature)

- **Available Deliveries**
  - New delivery requests
  - Delivery details preview
  - Distance from current location
  - Estimated payout
  - Accept/decline button
  - Auto-assignment if enabled

- **Delivery History**
  - Past deliveries list
  - Date, time, distance, earnings
  - Customer rating
  - View route taken

- **Earnings**
  - Today's earnings
  - Weekly total
  - Monthly total
  - Earnings breakdown by delivery
  - Tips received

- **Statistics**
  - Total deliveries completed
  - Average delivery time
  - Cancellation rate
  - Customer satisfaction rating
  - Active hours

- **Navigation**
  - Current position on map
  - Route to next delivery
  - Directions in Google Maps/Apple Maps
  - Traffic updates

- **Availability Status**
  - Toggle online/offline/on break
  - Auto-logout after inactivity

- **Documents**
  - License expiration
  - Vehicle registration
  - Insurance status
  - Expiration alerts

- **Profile**
  - Personal info
  - Vehicle details
  - Ratings received
  - Documents

- **Notifications & Messages**
  - New delivery requests
  - Customer messages
  - Delivery updates

- **Support**
  - Report issues
  - Contact support
  - FAQ

---

### 4. Admin Dashboard

**URL:** `/admin/dashboard`  
**Components:**

- **Header**
  - Admin role/department
  - Notifications
  - Admin menu

- **Overview Metrics**
  - Total users (clients, suppliers, drivers)
  - Today's orders
  - Total revenue
  - Active drivers
  - Active suppliers
  - Platform health status

- **Users Management Tab**
  - User list (filter by role, status)
  - Search by email, name, phone
  - View user details
  - Activate/suspend account
  - View audit trail
  - Reset password

- **Supplier Approvals Tab**
  - Pending supplier applications
  - Supplier details & documents
  - Approve/reject supplier
  - Request additional info
  - View verification status

- **Orders & Deliveries Tab**
  - All platform orders
  - Filter by status, date, supplier
  - Order details
  - Search by order ID, customer
  - Dispute resolution interface
  - Cancel order
  - Manual delivery assignment (if needed)

- **Financial Tab**
  - Total platform revenue
  - Supplier payouts (pending, completed)
  - Payment method breakdown
  - Commission collected
  - Financial reports & graphs

- **Analytics Tab**
  - Order volume trends
  - Revenue trends
  - User growth
  - Popular suppliers/products
  - Driver performance metrics
  - Geographic analytics (heat maps)
  - KPI dashboard

- **Notifications Management Tab**
  - View all notifications sent
  - Send system-wide notifications
  - Notification templates
  - Notification history

- **Configuration Tab**
  - Commission rates
  - Service fees
  - Delivery zones config
  - Promotional offers
  - System settings
  - API keys management

- **Support & Tickets Tab**
  - Customer support tickets
  - Ticket status (open, in progress, resolved)
  - Respond to tickets
  - View ticket history

- **Audit Log Tab**
  - All system actions
  - User logins
  - Data changes
  - Admin actions
  - Search & filter
  - Export audit report

---

## API Endpoints Matrix

| Endpoint | Method | Auth | Role | Purpose |
|----------|--------|------|------|---------|
| `/api/auth/signup` | POST | No | - | User registration |
| `/api/auth/login` | POST | No | - | User login |
| `/api/auth/logout` | POST | Yes | All | Logout |
| `/api/client/dashboard` | GET | Yes | client | Get client dashboard data |
| `/api/client/orders` | GET | Yes | client | List orders |
| `/api/client/orders` | POST | Yes | client | Create order |
| `/api/client/addresses` | GET | Yes | client | List addresses |
| `/api/client/addresses` | POST | Yes | client | Add address |
| `/api/supplier/dashboard` | GET | Yes | supplier | Get supplier dashboard data |
| `/api/supplier/products` | GET | Yes | supplier | List products |
| `/api/supplier/products` | POST | Yes | supplier | Add product |
| `/api/supplier/orders` | GET | Yes | supplier | List orders |
| `/api/driver/dashboard` | GET | Yes | driver | Get driver dashboard data |
| `/api/driver/deliveries/available` | GET | Yes | driver | Available deliveries |
| `/api/driver/deliveries/:id/accept` | POST | Yes | driver | Accept delivery |
| `/api/admin/dashboard` | GET | Yes | admin | Get admin dashboard data |
| `/api/admin/users` | GET | Yes | admin | List users |
| `/api/public/suppliers` | GET | No | - | Browse suppliers |
| `/api/public/products` | GET | No | - | Browse products |

---

## Error Handling Strategy

### Standard Error Response Format

```json
{
  "success": false,
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "status": 400,
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### HTTP Status Codes

| Status | Meaning | Use Case |
|--------|---------|----------|
| 200 | OK | Successful request |
| 201 | Created | Resource created |
| 204 | No Content | Successful delete |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Missing/invalid auth |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Duplicate resource |
| 422 | Unprocessable Entity | Validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Unexpected error |
| 503 | Service Unavailable | Maintenance/Down |

### Error Codes

```
AUTH_001 - Invalid credentials
AUTH_002 - Session expired
AUTH_003 - Unauthorized access
AUTH_004 - Email already registered
AUTH_005 - Token invalid

ORDER_001 - Order not found
ORDER_002 - Order already shipped
ORDER_003 - Insufficient stock
ORDER_004 - Invalid delivery address

PAYMENT_001 - Payment failed
PAYMENT_002 - Invalid payment method
PAYMENT_003 - Transaction declined

USER_001 - User not found
USER_002 - User suspended
USER_003 - User not verified

SUPPLIER_001 - Supplier not verified
SUPPLIER_002 - Zone not available

DRIVER_001 - Driver not available
DRIVER_002 - Driver suspended
```

---

## Data Validation Rules

### Signup Validation

```javascript
{
  email: {
    type: 'email',
    required: true,
    unique: true,
    maxLength: 255
  },
  password: {
    type: 'string',
    required: true,
    minLength: 8,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/ // at least one lowercase, uppercase, digit
  },
  role: {
    type: 'enum',
    required: true,
    values: ['client', 'supplier', 'driver', 'admin']
  },
  nom_complet: {
    type: 'string',
    required: true,
    minLength: 3,
    maxLength: 255
  },
  telephone: {
    type: 'string',
    required: true,
    pattern: /^\+?[0-9]{10,15}$/,
    unique: false // multiple users can have same number
  }
}
```

### Order Validation

```javascript
{
  fournisseur_id: {
    type: 'uuid',
    required: true,
    exists: 'fournisseurs'
  },
  adresse_livraison_id: {
    type: 'uuid',
    required: true,
    exists: 'adresses'
  },
  produits: {
    type: 'array',
    required: true,
    minItems: 1,
    items: {
      produit_id: { type: 'uuid', required: true },
      quantite: { type: 'integer', required: true, min: 1 },
      options: { type: 'object' }
    }
  },
  mode_paiement: {
    type: 'enum',
    required: true,
    values: ['especes', 'carte']
  }
}
```

---

## Implementation Checklist

### Phase 1: Core Infrastructure (Week 1)

- [ ] Create middleware structure
  - [ ] Authentication middleware
  - [ ] Authorization (RBAC) middleware
  - [ ] Input validation middleware
  - [ ] Error handling middleware
  - [ ] Audit logging middleware

- [ ] Refactor database layer
  - [ ] Create database connection manager
  - [ ] Create query builders
  - [ ] Setup transaction support
  - [ ] Create schema validation functions

- [ ] Setup configuration
  - [ ] Environment variables
  - [ ] Constants file
  - [ ] Config file structure

### Phase 2: Authentication Service (Week 2)

- [ ] Implement signup endpoint
  - [ ] Input validation
  - [ ] Password hashing
  - [ ] Role-specific table creation (transactional)
  - [ ] Session token generation
  - [ ] Email verification setup

- [ ] Implement login endpoint
  - [ ] Credentials verification
  - [ ] Session creation
  - [ ] Token generation
  - [ ] IP/User-agent logging

- [ ] Implement logout endpoint
  - [ ] Session invalidation
  - [ ] Token cleanup

- [ ] Implement refresh token
  - [ ] Token extension logic
  - [ ] Expiration handling

### Phase 3: Client Dashboard Routes (Week 2-3)

- [ ] Profile management endpoints
- [ ] Orders endpoints (create, list, update, cancel)
- [ ] Addresses endpoints (CRUD)
- [ ] Favorites endpoints
- [ ] Payment methods endpoints
- [ ] Notifications endpoints
- [ ] Order tracking (real-time via websockets)

### Phase 4: Supplier Dashboard Routes (Week 3)

- [ ] Profile & verification endpoints
- [ ] Product management endpoints (CRUD)
- [ ] Inventory management
- [ ] Order management (list, accept, update status)
- [ ] Revenue analytics endpoints
- [ ] Delivery zones endpoints
- [ ] Reviews & ratings endpoints
- [ ] Settings endpoints

### Phase 5: Driver Dashboard Routes (Week 3-4)

- [ ] Profile & document management
- [ ] Available deliveries endpoints
- [ ] Accept/decline delivery endpoints
- [ ] Delivery status update (with GPS)
- [ ] Earnings & statistics endpoints
- [ ] Delivery history endpoints
- [ ] Ratings endpoints
- [ ] Availability status toggle

### Phase 6: Admin Dashboard Routes (Week 4)

- [ ] Dashboard overview endpoints
- [ ] User management endpoints
- [ ] Supplier approval endpoints
- [ ] Order management endpoints
- [ ] Financial reporting endpoints
- [ ] Analytics endpoints
- [ ] Notification management endpoints
- [ ] Configuration endpoints
- [ ] Support ticket endpoints
- [ ] Audit log endpoints

### Phase 7: Shared Functionality (Week 4)

- [ ] Multi-role review endpoints
- [ ] Shared notification system
- [ ] Address management (shared)
- [ ] Payment processing endpoints
- [ ] Support chat endpoints

### Phase 8: Testing & Optimization (Week 5)

- [ ] Unit tests for controllers
- [ ] Integration tests for routes
- [ ] Authentication flow testing
- [ ] Permission/authorization testing
- [ ] Performance optimization
- [ ] Security audit

### Phase 9: Frontend Integration (Week 5-6)

- [ ] Angular component creation for each dashboard
- [ ] Route guards for frontend
- [ ] API integration
- [ ] Real-time updates (websockets/polling)
- [ ] Map integration (Google Maps/Mapbox)
- [ ] Push notification setup

### Phase 10: Deployment (Week 6)

- [ ] Database migration
- [ ] Backend deployment
- [ ] Frontend deployment
- [ ] Setup monitoring & logging
- [ ] Performance tuning
- [ ] Security hardening

---

## Next Steps

1. **Review this document** with the development team
2. **Create a detailed feature branch** for each dashboard
3. **Implement middleware stack first** (foundation)
4. **Begin Phase 1 implementation** (Week 1)
5. **Follow the API Endpoints Matrix** for endpoint creation
6. **Use the Error Handling Strategy** for consistency
7. **Test each phase before moving to next**

---

**Document Version:** 1.0  
**Last Updated:** December 6, 2025  
**Status:** Ready for Implementation
