# Complete Session Management Reference

**Status:** ✅ FULLY IMPLEMENTED  
**Date:** December 6, 2025  
**Scope:** Production-ready session management using `sessions_utilisateurs` table

---

## Quick Start

### 1. User Logs In
```bash
POST http://localhost:3000/api/auth/login
{
  "email": "user@example.com",
  "mot_de_passe": "Password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "role": "client",
    "session_token": "aef0d1e2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9",
    "session_id": "e8400550-e29b-41d4-a716-446655440001",
    "expires_at": "2025-12-07T14:30:00Z"
  }
}
```

### 2. Frontend Stores Token
```javascript
sessionStorage.setItem('session_token', userData.session_token);
```

### 3. All Protected Requests Include Token
```bash
Authorization: Bearer aef0d1e2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9
```

### 4. User Logs Out
```bash
POST http://localhost:3000/api/auth/logout
{
  "session_token": "aef0d1e2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9"
}
```

---

## Implementation Details

### What Happens on Login

1. **Email validation** - User exists in `utilisateurs` table
2. **Password check** - `bcrypt.compare(password, user.mot_de_passe)`
3. **Account status** - Verify `statut = 'actif'` or `'verifie'`
4. **Session creation** - `createUserSession()` called
   - Generate 96-char random token
   - Set expiration to 24 hours
   - Insert into `sessions_utilisateurs`
   - Capture IP address
   - Capture user-agent
5. **Update last login** - `utilisateurs.derniere_connexion = NOW()`
6. **Return session** - Send token and user data to frontend

### What Happens on Protected Request

1. **Extract token** - From Authorization header, body, or query param
2. **Query database** - Check `sessions_utilisateurs` table
3. **Validate status** - Ensure `est_active = true` AND `date_expiration > NOW()`
4. **Attach user** - Set `req.user` with session data
5. **Proceed** - Call route handler

### What Happens on Logout

1. **Find session** - Query by `token_session`
2. **Mark inactive** - Set `est_active = false`
3. **Confirm** - Return success response
4. **Frontend** - Clear `sessionStorage`

---

## File Structure

```
api-express/
├── routes/
│   ├── auth.routes.js              ← Login/logout/verify
│   └── sessions_utilisateurs.routes.js  ← Session management
├── middleware/
│   └── auth.middleware.js           ← Session validation
└── server.js                        ← Route registration

Database:
└── sessions_utilisateurs table      ← Persistent storage
```

---

## API Reference

### Authentication Routes

#### POST /api/auth/login
**Create session on login**

Request:
```json
{
  "email": "user@example.com",
  "mot_de_passe": "Password123"
}
```

Response (200):
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "nom_complet": "John Doe",
    "role": "client|supplier|driver|admin",
    "session_token": "96-char-hex-string",
    "session_id": "uuid",
    "expires_at": "2025-12-07T14:30:00Z"
  }
}
```

Response (401):
```json
{
  "success": false,
  "code": "INVALID_CREDENTIALS",
  "message": "Invalid email or password"
}
```

---

#### POST /api/auth/logout
**Invalidate session on logout**

Request:
```json
{
  "session_token": "96-char-hex-string"
}
```

Response (200):
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

#### POST /api/auth/verify-session
**Check if session is still valid (no auth required)**

Request:
```json
{
  "session_token": "96-char-hex-string"
}
```

Response (200):
```json
{
  "success": true,
  "session": {
    "id": "uuid",
    "token": "96-char-hex-string",
    "is_active": true,
    "expires_at": "2025-12-07T14:30:00Z"
  },
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "nom_complet": "John Doe",
    "role": "client",
    "statut": "actif"
  }
}
```

Response (401):
```json
{
  "success": false,
  "code": "SESSION_INVALID",
  "message": "Session is invalid or expired"
}
```

---

### Session Management Routes

All session management routes require authentication except `/validate`.

#### GET /api/sessions
**List all sessions for current user (all devices)**

Headers:
```
Authorization: Bearer <session_token>
```

Response (200):
```json
{
  "success": true,
  "data": [
    {
      "id": "session-uuid-1",
      "token": "aef0d1e2b3c4d5e6f7...",
      "created_at": "2025-12-06T14:30:00Z",
      "expires_at": "2025-12-07T14:30:00Z",
      "is_active": true,
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "is_current": true
    },
    {
      "id": "session-uuid-2",
      "token": "f7e6d5c4b3a2...",
      "created_at": "2025-12-05T10:00:00Z",
      "expires_at": "2025-12-06T10:00:00Z",
      "is_active": true,
      "ip_address": "192.168.1.200",
      "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)",
      "is_current": false
    }
  ],
  "total": 2
}
```

---

#### PATCH /api/sessions/:session_id/logout
**Logout from specific device**

Headers:
```
Authorization: Bearer <session_token>
```

Response (200):
```json
{
  "success": true,
  "message": "Session logged out successfully",
  "data": {
    "id": "session-uuid",
    "token": "aef0d1e2b3c4d5e6f7..."
  }
}
```

---

#### POST /api/sessions/logout-all
**Logout from all devices**

Headers:
```
Authorization: Bearer <session_token>
```

Response (200):
```json
{
  "success": true,
  "message": "Logged out from 3 device(s)",
  "data": {
    "sessions_invalidated": 3
  }
}
```

---

#### POST /api/sessions/revoke
**Revoke session by token**

Headers:
```
Authorization: Bearer <session_token>
```

Request:
```json
{
  "session_token": "token-to-revoke"
}
```

Response (200):
```json
{
  "success": true,
  "message": "Session revoked successfully"
}
```

---

#### POST /api/sessions/validate
**Validate session without authentication**

Request:
```json
{
  "session_token": "96-char-hex-string"
}
```

Response (200 - Valid):
```json
{
  "success": true,
  "message": "Session is valid",
  "data": {
    "is_valid": true,
    "expires_at": "2025-12-07T14:30:00Z",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "client"
    }
  }
}
```

Response (401 - Invalid):
```json
{
  "success": false,
  "message": "Session is invalid or expired"
}
```

---

#### POST /api/sessions/extend
**Extend session (keep-alive)**

Headers:
```
Authorization: Bearer <session_token>
```

Response (200):
```json
{
  "success": true,
  "message": "Session extended successfully",
  "data": {
    "expires_at": "2025-12-08T14:30:00Z"
  }
}
```

---

#### GET /api/sessions/cleanup/expired
**Admin: Clean up expired sessions (>30 days old)**

Headers:
```
Authorization: Bearer <admin_session_token>
```

Response (200):
```json
{
  "success": true,
  "message": "Cleaned up 2341 expired sessions",
  "data": {
    "deleted_count": 2341
  }
}
```

---

## Database Schema

### sessions_utilisateurs Table

```sql
CREATE TABLE public.sessions_utilisateurs (
  id UUID NOT NULL PRIMARY KEY,
  utilisateur_id UUID NOT NULL REFERENCES public.utilisateurs(id) ON DELETE CASCADE,
  token_session VARCHAR(255) NOT NULL UNIQUE,
  adresse_ip VARCHAR(45),
  user_agent TEXT,
  date_creation TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  date_expiration TIMESTAMP NOT NULL,
  est_active BOOLEAN NOT NULL DEFAULT true
);

-- Indexes
CREATE INDEX idx_token_session ON sessions_utilisateurs(token_session);
CREATE INDEX idx_utilisateur_sessions ON sessions_utilisateurs(utilisateur_id, est_active);

-- Trigger for auto-cleanup (optional)
CREATE TRIGGER trigger_cleanup_expired_sessions
AFTER INSERT ON sessions_utilisateurs
FOR EACH STATEMENT
EXECUTE FUNCTION cleanup_expired_sessions();
```

---

## Error Codes

| HTTP | Code | Message | Cause |
|------|------|---------|-------|
| 400 | VALIDATION_ERROR | Missing required fields | No email/password/token |
| 401 | INVALID_CREDENTIALS | Invalid email or password | Wrong credentials |
| 401 | SESSION_INVALID | Session is invalid or expired | Token expired/not found |
| 403 | ACCOUNT_INACTIVE | Account is {status} | User account not active |
| 404 | SESSION_NOT_FOUND | Session not found | Session ID doesn't exist |
| 409 | EMAIL_EXISTS | Email already registered | Signup: email taken |
| 500 | SERVER_ERROR | Server error | Database error |

---

## Session Security

### Token Security
- **Generation**: `crypto.randomBytes(48).toString('hex')` = 96 characters
- **Storage**: `sessionStorage` (cleared on tab close)
- **Transport**: Authorization header with `Bearer` scheme
- **HTTPS**: Required in production

### Session Validation
- **Every request**: Token validated in `authMiddleware`
- **Two checks**: 
  1. Token exists in database
  2. `est_active = true` AND `date_expiration > NOW()`
- **Single source of truth**: `sessions_utilisateurs` table

### Account Protection
- **Status check**: Only `actif` or `verifie` users can login
- **Inactive detection**: Login blocked if `statut != 'actif|verifie'`
- **Force logout**: Admin can deactivate account to force all logouts

### Audit Trail
- **IP tracking**: All sessions logged with client IP
- **User-agent**: Device identification for security review
- **Timestamps**: Created and expiration times logged
- **Activity logging**: Available via `/api/audit` endpoint

---

## Frontend Integration Examples

### Angular Login Component
```typescript
login() {
  this.authService.login(this.email, this.password).subscribe({
    next: (response) => {
      // Store token
      sessionStorage.setItem('session_token', response.user.session_token);
      sessionStorage.setItem('user', JSON.stringify(response.user));
      
      // Update service
      this.authService.currentUser.next(response.user);
      
      // Redirect
      this.router.navigate([`/${response.user.role}/dashboard`]);
    },
    error: (error) => {
      this.toastr.error(error.error.message);
    }
  });
}
```

### Auth Interceptor
```typescript
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
        sessionStorage.clear();
        this.router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
}
```

### Session Validation on Load
```typescript
ngOnInit() {
  const token = sessionStorage.getItem('session_token');
  
  if (token) {
    this.authService.validateSession(token).subscribe({
      next: (response) => {
        this.authService.currentUser.next(response.user);
      },
      error: () => {
        sessionStorage.clear();
        this.router.navigate(['/login']);
      }
    });
  }
}
```

### Logout
```typescript
logout() {
  const token = sessionStorage.getItem('session_token');
  
  this.authService.logout(token).subscribe({
    next: () => {
      sessionStorage.clear();
      this.authService.currentUser.next(null);
      this.router.navigate(['/']);
    }
  });
}
```

---

## Testing Checklist

- [ ] User can login with email/password
- [ ] Session token returned and stored
- [ ] Protected routes require token
- [ ] 401 returned for missing token
- [ ] 401 returned for invalid token
- [ ] 401 returned for expired token
- [ ] User can logout successfully
- [ ] Session marked inactive after logout
- [ ] Token cannot be reused after logout
- [ ] Multiple logins create separate sessions
- [ ] List all sessions shows all devices
- [ ] Logout from one device doesn't affect others
- [ ] Logout from all devices works
- [ ] Session validation passes for valid token
- [ ] Session validation fails for invalid token
- [ ] Session can be extended (keep-alive)
- [ ] Session expires after 24 hours
- [ ] IP address is stored
- [ ] User-agent is stored
- [ ] Account status is checked on login
- [ ] Inactive accounts cannot login

---

## Performance Considerations

### Database Queries
- **Index on token_session**: Fast token lookup
- **Index on (utilisateur_id, est_active)**: Fast user session list
- **Foreign key cascade**: Cleanup on user delete

### Scalability
- **Separate table**: Doesn't bloat `utilisateurs` table
- **Cleanup policy**: Auto-remove sessions >30 days
- **Stateless validation**: No in-memory session store

### Optimization
- **Token as primary lookup**: Direct by token, not by user
- **Active flag**: Quick filter on every request
- **Expiration timestamp**: Simple datetime comparison

---

## Deployment Checklist

- [ ] Update CORS `origin` to production frontend URL
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS only
- [ ] Increase session expiration if needed (not recommended)
- [ ] Setup automated session cleanup
- [ ] Configure database backups
- [ ] Setup monitoring for failed logins
- [ ] Enable SSL for database connection
- [ ] Rotate session cleanup daily
- [ ] Review audit logs regularly

---

## Complete! ✅

Session management is fully implemented and ready for production use.

**Key Achievements:**
- ✅ Sessions created on login
- ✅ Sessions stored in database
- ✅ Sessions validated on protected routes
- ✅ Multi-device support
- ✅ Automatic expiration (24 hours)
- ✅ Keep-alive extension
- ✅ Security audit trail
- ✅ Admin cleanup tools
- ✅ Production-ready error handling
