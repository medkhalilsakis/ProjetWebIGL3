# Session Management Implementation Guide

**Created:** December 6, 2025  
**Status:** Complete  
**Version:** 1.0

---

## Overview

The session management system uses the `sessions_utilisateurs` table to manage user authentication across the platform. When a user logs in, a session is created and tracked. This document explains the complete session lifecycle.

---

## Session Lifecycle

### 1. Login Flow

```
User submits credentials
    ↓
POST /api/auth/login
    ↓
Validate email & password
    ↓
Check account status (actif/verifie)
    ↓
createUserSession() called
    ↓
Session record created in sessions_utilisateurs
    ↓
User's derniere_connexion updated
    ↓
Session token returned to frontend
    ↓
Frontend stores token in sessionStorage
```

### 2. Login Implementation (`auth.routes.js`)

```javascript
// User logs in with email and password
POST /api/auth/login
Body: {
  email: "user@example.com",
  mot_de_passe: "SecurePassword123"
}

// Response on success
{
  success: true,
  message: "Login successful",
  user: {
    id: "uuid-here",
    email: "user@example.com",
    nom_complet: "John Doe",
    role: "client|supplier|driver|admin",
    session_token: "cryptographically-secure-token",
    session_id: "uuid-here",
    expires_at: "2025-12-07T14:30:00Z"
  }
}
```

**Key Functions:**
- `createUserSession(user, req)` - Creates new session in DB with IP and user-agent tracking
- `getUserWithRoles(email)` - Fetches user with all role-specific data joined
- Session token is 48-byte cryptographic random generated with `crypto.randomBytes(48)`
- Expiration is set to 24 hours from login time
- Last login timestamp updated in `utilisateurs.derniere_connexion`

---

## Session Storage in Database

### `sessions_utilisateurs` Table Structure

```sql
Column              Type              Purpose
=========================================================
id                  UUID              Primary key (session ID)
utilisateur_id      UUID              FK to utilisateurs.id
token_session       VARCHAR(255)      Unique session token
adresse_ip          VARCHAR(45)       Client IP address
user_agent          TEXT              Browser/client info
date_creation       TIMESTAMP         When session was created
date_expiration     TIMESTAMP         When session expires
est_active          BOOLEAN           Is session still valid
```

### Session Properties Stored

- **Token**: 96-character hex string (48 bytes in hex = 96 chars)
- **IP Address**: From `req.ip` or `req.connection.remoteAddress`
- **User-Agent**: Browser/client identifier for device recognition
- **Expiration**: Exactly 24 hours from creation
- **Active Status**: Toggled on logout

---

## Session Management Routes

### 1. Get All Sessions (User's Devices)

```javascript
GET /api/sessions
Authorization: Bearer <session_token>

// Response: List of all active sessions for user
{
  success: true,
  data: [
    {
      id: "uuid-1",
      token: "session-token-first-20-chars...",
      created_at: "2025-12-06T14:30:00Z",
      expires_at: "2025-12-07T14:30:00Z",
      is_active: true,
      ip_address: "192.168.1.100",
      user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
      is_current: true  // Current device
    },
    {
      id: "uuid-2",
      token: "session-token-first-20-chars...",
      created_at: "2025-12-05T10:00:00Z",
      expires_at: "2025-12-06T10:00:00Z",
      is_active: true,
      ip_address: "192.168.1.200",
      user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)...",
      is_current: false  // Another device
    }
  ],
  total: 2
}
```

**Use Case:** User can see all devices they're logged in from (security feature)

---

### 2. Logout from Specific Device

```javascript
PATCH /api/sessions/:session_id/logout
Authorization: Bearer <session_token>

// Response
{
  success: true,
  message: "Session logged out successfully",
  data: {
    id: "uuid-here",
    token: "session-token-first-20-chars..."
  }
}
```

**Use Case:** User can log out from a specific device without affecting other sessions

---

### 3. Logout from All Devices

```javascript
POST /api/sessions/logout-all
Authorization: Bearer <session_token>

// Response
{
  success: true,
  message: "Logged out from 3 device(s)",
  data: {
    sessions_invalidated: 3
  }
}
```

**Use Case:** Security feature - user can immediately invalidate all sessions (if password compromised)

---

### 4. Revoke Session by Token

```javascript
POST /api/sessions/revoke
Authorization: Bearer <session_token>
Body: {
  session_token: "token-to-revoke"
}

// Response
{
  success: true,
  message: "Session revoked successfully"
}
```

**Use Case:** Frontend calls this when user explicitly logs out

---

### 5. Validate Session

```javascript
POST /api/sessions/validate
Body: {
  session_token: "token-to-validate"
}

// Response (no auth required - for silent checks)
{
  success: true,
  message: "Session is valid",
  data: {
    is_valid: true,
    expires_at: "2025-12-07T14:30:00Z",
    user: {
      id: "user-id",
      email: "user@example.com",
      role: "client"
    }
  }
}

// Response if invalid
{
  success: false,
  message: "Session is invalid or expired"
}
```

**Use Case:** Frontend checks if stored token is still valid (on page refresh, on app load)

---

### 6. Extend Session (Keep-Alive)

```javascript
POST /api/sessions/extend
Authorization: Bearer <session_token>

// Response
{
  success: true,
  message: "Session extended successfully",
  data: {
    expires_at: "2025-12-08T14:30:00Z"  // Now +24 hours
  }
}
```

**Use Case:** When user is actively using the platform, extend their session automatically
- Should be called periodically (e.g., every 30 minutes of activity)
- Prevents session timeout during active use

---

### 7. Cleanup Expired Sessions (Admin Only)

```javascript
GET /api/sessions/cleanup/expired
Authorization: Bearer <admin_session_token>

// Response
{
  success: true,
  message: "Cleaned up 2341 expired sessions",
  data: {
    deleted_count: 2341
  }
}
```

**Use Case:** Maintenance endpoint - admin runs to clean up old sessions
- Deletes sessions expired more than 30 days ago
- Prevents database bloat

---

## Authentication Middleware Integration

### How Auth Middleware Uses Sessions

```javascript
// middleware/auth.middleware.js
const authMiddleware = async (req, res, next) => {
  // 1. Extract token from multiple sources
  const token = extractTokenFromRequest(req);
  
  // 2. Query sessions_utilisateurs table
  const result = await db.query(
    `SELECT s.*, u.id as user_id, u.role, ...
     FROM sessions_utilisateurs s
     JOIN utilisateurs u ON s.utilisateur_id = u.id
     WHERE s.token_session = $1 
       AND s.est_active = true
       AND s.date_expiration > CURRENT_TIMESTAMP`,
    [token]
  );
  
  // 3. Attach user object to request if valid
  if (result.rows.length > 0) {
    req.user = result.rows[0];
    next();
  } else {
    res.status(401).json({ success: false, message: 'Session invalid or expired' });
  }
};
```

**Token Sources (Priority Order):**
1. Authorization header: `Authorization: Bearer <token>`
2. Request body: `{ session_token: "<token>" }`
3. Query parameter: `?session_token=<token>`

---

## Frontend Integration

### 1. After Login - Store Token

```typescript
// login.ts
login() {
  this.authService.login(this.email, this.password).subscribe(
    (response) => {
      const userData = response.user;
      
      // Store in sessionStorage
      sessionStorage.setItem('session_token', userData.session_token);
      sessionStorage.setItem('user', JSON.stringify(userData));
      
      // Update service
      this.authService.currentUser.next(userData);
      
      // Redirect to dashboard
      this.router.navigate([`/${userData.role}/dashboard`]);
    },
    (error) => console.error('Login failed', error)
  );
}
```

### 2. Auth Interceptor - Attach Token to Requests

```typescript
// auth.interceptor.ts
intercept(req: HttpRequest<any>, next: HttpHandler) {
  const token = sessionStorage.getItem('session_token');
  
  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }
  
  return next.handle(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Session expired - logout
        this.authService.logout();
        this.router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
}
```

### 3. On Logout - Clear Token

```typescript
// logout.ts
logout() {
  const token = sessionStorage.getItem('session_token');
  
  this.authService.logout(token).subscribe(
    () => {
      // Clear storage
      sessionStorage.clear();
      
      // Update service
      this.authService.currentUser.next(null);
      
      // Redirect to home
      this.router.navigate(['/']);
    }
  );
}
```

### 4. Session Validation (On Page Load)

```typescript
// app.ts
ngOnInit() {
  const token = sessionStorage.getItem('session_token');
  
  if (token) {
    // Validate token is still active
    this.authService.validateSession(token).subscribe(
      (response) => {
        // Session still valid
        this.authService.currentUser.next(response.user);
      },
      () => {
        // Session expired - clear storage
        sessionStorage.clear();
        this.router.navigate(['/login']);
      }
    );
  }
}
```

### 5. Session Keep-Alive (Optional)

```typescript
// Keep session alive during active use
setInterval(() => {
  const token = sessionStorage.getItem('session_token');
  
  if (token) {
    this.authService.extendSession().subscribe(
      (response) => {
        console.log('Session extended until', response.data.expires_at);
      }
    );
  }
}, 30 * 60 * 1000); // Every 30 minutes
```

---

## Error Handling

### Session Errors

| Status | Error Code | Cause | Action |
|--------|-----------|-------|--------|
| 400 | VALIDATION_ERROR | Missing token | Redirect to login |
| 401 | SESSION_INVALID | Token invalid/expired | Clear storage, redirect to login |
| 403 | ACCOUNT_INACTIVE | User account not active | Show message, don't redirect |
| 404 | SESSION_NOT_FOUND | Session ID doesn't exist | Continue, may have logged out elsewhere |
| 500 | SERVER_ERROR | Database error | Show error message |

---

## Security Best Practices

### 1. Token Security
- ✅ 96-character random token (48 bytes) - cryptographically secure
- ✅ Tokens stored in `sessionStorage` (not `localStorage`) - clears on tab close
- ✅ Tokens only sent over HTTPS (production requirement)
- ✅ CORS enabled only for `http://localhost:4200` (development)

### 2. Session Expiration
- ✅ 24-hour session lifetime
- ✅ Automatic validation on every protected request
- ✅ Keep-alive extension prevents timeout during active use
- ✅ Old sessions cleaned up after 30 days

### 3. IP & User-Agent Tracking
- ✅ IP address stored (useful for security audits)
- ✅ User-agent logged (detect suspicious logins)
- ✅ Multiple sessions per user allowed (multi-device support)

### 4. Account Status Checks
- ✅ Only `actif` or `verifie` users can create sessions
- ✅ Inactive accounts can't log in
- ✅ Admin can deactivate accounts to force logout

---

## Database Queries

### Current Active Sessions (for a user)

```sql
SELECT * FROM sessions_utilisateurs
WHERE utilisateur_id = $1 
  AND est_active = true
  AND date_expiration > CURRENT_TIMESTAMP
ORDER BY date_creation DESC;
```

### Expired Sessions (cleanup)

```sql
DELETE FROM sessions_utilisateurs
WHERE date_expiration < (CURRENT_TIMESTAMP - INTERVAL '30 days');
```

### Session Activity Report (admin)

```sql
SELECT 
  u.email,
  COUNT(DISTINCT s.id) as session_count,
  MAX(s.date_creation) as last_login,
  COUNT(CASE WHEN s.est_active THEN 1 END) as active_sessions
FROM sessions_utilisateurs s
JOIN utilisateurs u ON s.utilisateur_id = u.id
GROUP BY u.id
ORDER BY last_login DESC;
```

---

## Testing the Session Flow

### 1. Test Login with Session Creation

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "mot_de_passe": "TestPass123"
  }'

# Response includes session_token
```

### 2. Test Protected Route with Session Token

```bash
curl -X GET http://localhost:3000/api/sessions \
  -H "Authorization: Bearer <session_token_from_above>"

# Response shows all sessions for user
```

### 3. Test Session Validation

```bash
curl -X POST http://localhost:3000/api/sessions/validate \
  -H "Content-Type: application/json" \
  -d '{
    "session_token": "<session_token>"
  }'

# Response confirms session is valid
```

### 4. Test Logout

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{
    "session_token": "<session_token>"
  }'

# After logout, validation should fail
```

---

## Summary

**When user logs in:**
1. Email/password validated
2. New session created in `sessions_utilisateurs` table
3. Session token (96-char random) generated and returned
4. Token stored on frontend in `sessionStorage`
5. Token attached to all future requests via `AuthInterceptor`

**Session lifecycle:**
- Created: Login
- Extended: User activity (keep-alive)
- Validated: Every protected request
- Invalidated: Logout or expiration
- Cleaned up: After 30 days

**Security:**
- Tokens are cryptographically random
- Sessions expire after 24 hours
- Multiple sessions allowed per user (multi-device)
- IP & user-agent tracked
- Account status verified on login
- Old sessions auto-cleaned

This implementation provides secure, multi-device session management for the LivraXpress platform.
