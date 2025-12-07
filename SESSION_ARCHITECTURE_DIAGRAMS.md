# Session Management Architecture Diagram

---

## Complete Session Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         LOGIN SEQUENCE                                  │
└─────────────────────────────────────────────────────────────────────────┘

        Frontend                  Backend                     Database
        --------                  -------                     --------

        User enters
        email + password
            │
            ├─POST /api/auth/login─┐
            │                       │
            │                       ├─Check utilisateurs table
            │                       ├─Verify password (bcrypt)
            │                       ├─Check account status
            │                       │
            │                       ├─Call createUserSession()
            │                       │   ├─Generate 96-char token
            │                       │   └─INSERT into sessions_utilisateurs
            │                       │       ├─id (UUID)
            │                       │       ├─utilisateur_id
            │                       │       ├─token_session
            │                       │       ├─adresse_ip
            │                       │       ├─user_agent
            │                       │       ├─date_expiration (+24h)
            │                       │       └─est_active = true
            │                       │
            │                       ├─UPDATE utilisateurs
            │                       │   └─derniere_connexion = NOW()
            │                       │
        ◄──Response with token─────┤
        {session_token, expires}
            │
        Store in
        sessionStorage
            │
        ─────────────────────────────────────────────────────────────────
            │
        User navigates
        to dashboard
            │
        ├─GET /api/client/dashboard─┐
        │  Header: Bearer {token}    │
        │                            ├─AuthMiddleware extracts token
        │                            ├─Query sessions_utilisateurs:
        │                            │  WHERE token_session = $1
        │                            │    AND est_active = true
        │                            │    AND date_expiration > NOW()
        │                            │
        │                            ├─If valid:
        │                            │  ├─Attach user to req.user
        │                            │  └─Proceed with handler
        │                            │
        │                            ├─If invalid:
        │                            │  └─Return 401 Unauthorized
        │                            │
        ◄──Dashboard data──────────┤
        {orders, favorites, etc}
            │


┌─────────────────────────────────────────────────────────────────────────┐
│                       LOGOUT SEQUENCE                                   │
└─────────────────────────────────────────────────────────────────────────┘

        Frontend                  Backend                     Database
        --------                  -------                     --------

        User clicks
        Logout button
            │
        ├─POST /api/auth/logout─┐
        │  Body: {session_token}│
        │                        ├─Extract token from body
        │                        ├─Call invalidateSession()
        │                        │   └─UPDATE sessions_utilisateurs
        │                        │       SET est_active = false
        │                        │       WHERE token_session = $1
        │                        │
        ◄──Logout confirmed─────┤
        {success: true}
            │
        Clear sessionStorage
            │
        Redirect to /login
            │


┌─────────────────────────────────────────────────────────────────────────┐
│                   MULTI-DEVICE SESSIONS                                 │
└─────────────────────────────────────────────────────────────────────────┘

        User Login from Device 1 (Desktop)
        ├─Session created: aef0d1e2b3c4... (IP: 192.168.1.100)
        └─Stored in database

        User Login from Device 2 (Mobile)
        ├─New session created: f7e6d5c4b3a2... (IP: 192.168.1.200)
        └─Stored in database (different row, same user)

        GET /api/sessions
        ├─Returns all 2 sessions
        └─User can see they're logged in from 2 devices

        User clicks "Logout from all devices"
        ├─POST /api/sessions/logout-all
        ├─UPDATE est_active = false for all sessions
        └─Both devices logged out immediately


┌─────────────────────────────────────────────────────────────────────────┐
│              SESSION VALIDATION (NO AUTH)                               │
└─────────────────────────────────────────────────────────────────────────┘

        Frontend                  Backend                     Database
        --------                  -------                     --------

        App loads, checks
        localStorage
            │
        If token exists:
            │
        ├─POST /api/sessions/validate─┐
        │  Body: {session_token}       │
        │  (No Authorization header)   │
        │                              ├─Query sessions_utilisateurs
        │                              │  WHERE token_session = $1
        │                              │
        ◄──Session status──────────────┤
        {is_valid: true/false}
            │
        If valid:
        ├─Store user in service
        └─Load dashboard
        
        If invalid:
        ├─Clear sessionStorage
        └─Redirect to login


┌─────────────────────────────────────────────────────────────────────────┐
│               SESSION EXTENSION (KEEP-ALIVE)                            │
└─────────────────────────────────────────────────────────────────────────┘

        Every 30 minutes of activity:
            │
        ├─POST /api/sessions/extend─┐
        │  Header: Bearer {token}    │
        │                            ├─Find current session
        │                            ├─UPDATE date_expiration = NOW() + 24h
        │                            │
        ◄──Extended until──────────┤
        {expires_at: "2025-12-08T..."}
            │
        Session stays active for another 24 hours


┌─────────────────────────────────────────────────────────────────────────┐
│            DATABASE TABLE STRUCTURE                                     │
└─────────────────────────────────────────────────────────────────────────┘

sessions_utilisateurs
═══════════════════════════════════════════════════════════════════════════

┌─────────────────┬────────────────────────────────────────────────────┐
│  Column         │  Value Example                                     │
├─────────────────┼────────────────────────────────────────────────────┤
│ id              │ 550e8400-e29b-41d4-a716-446655440000 (PK)         │
│ utilisateur_id  │ f47ac10b-58cc-4372-a567-0e02b2c3d479 (FK)         │
│ token_session   │ aef0d1e2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9... │
│ adresse_ip      │ 192.168.1.100                                      │
│ user_agent      │ Mozilla/5.0 (Windows NT 10.0; Win64; x64)...      │
│ date_creation   │ 2025-12-06 14:30:45.123456                        │
│ date_expiration │ 2025-12-07 14:30:45.123456 (+24 hours)            │
│ est_active      │ true                                               │
└─────────────────┴────────────────────────────────────────────────────┘

Indexes:
  - PK: sessions_utilisateurs_pkey (id)
  - FK: sessions_utilisateurs_utilisateur_id_fkey (utilisateur_id → utilisateurs.id)
  - IDX: idx_token_session (token_session) - for fast lookup
  - IDX: idx_utilisateur_sessions (utilisateur_id, est_active)


┌─────────────────────────────────────────────────────────────────────────┐
│              ERROR HANDLING FLOW                                        │
└─────────────────────────────────────────────────────────────────────────┘

        Request without token
                │
                ├─AuthMiddleware checks
                │  └─No token found
                │
        ◄──401 Unauthorized
        {message: "Token manquant"}
                │
        Frontend handles 401
        ├─Clear sessionStorage
        └─Redirect to /login


        Request with expired token
                │
                ├─AuthMiddleware checks
                │  └─Query returns 0 rows
                │     (est_active=false OR date_expiration < NOW())
                │
        ◄──401 Unauthorized
        {message: "Session invalide ou expirée"}
                │
        Frontend handles 401
        ├─Clear sessionStorage
        └─Redirect to /login


        Request with valid token but inactive account
                │
                ├─AuthMiddleware checks
                │  ├─Token valid
                │  └─But user.statut = 'suspendu'
                │
        ◄──403 Forbidden
        {message: "Account is suspendu. Contact support."}
                │
        Frontend shows message
        (doesn't redirect)


┌─────────────────────────────────────────────────────────────────────────┐
│         TOKEN LIFECYCLE (24 HOURS)                                      │
└─────────────────────────────────────────────────────────────────────────┘

T+0h     Token created at login
├─Stored in sessions_utilisateurs
├─Returned to frontend
└─Stored in sessionStorage

T+1h     User actively using app
├─AuthMiddleware validates on every request
└─Session still valid

T+12h    User inactive for 12 hours
├─Session still valid if checked
└─Will expire if not extended

T+23h    User about to exceed 24h limit
├─Optional: Call POST /api/sessions/extend
├─date_expiration updated to T+47h
└─Session reset to 24h from now

T+24h    Token expires if not extended
├─Next API call fails with 401
├─Frontend clears token
└─User redirected to login

OR (if extended)

T+47h    Extended token expires
├─Same as above
└─Cycle repeats


┌─────────────────────────────────────────────────────────────────────────┐
│           SECURITY FEATURES                                            │
└─────────────────────────────────────────────────────────────────────────┘

✓ Cryptographically Random Tokens (48 bytes = 96 hex chars)
  └─Generated with: crypto.randomBytes(48).toString('hex')

✓ IP Address Tracking
  └─Logged from: req.ip or req.connection.remoteAddress

✓ User-Agent Logging
  └─Logged from: req.headers['user-agent']

✓ Account Status Verification
  └─Only 'actif' or 'verifie' users can login

✓ Session Expiration
  └─Automatic 24-hour timeout

✓ Multiple Device Support
  └─Each device = separate session row

✓ Audit Trail
  └─All logins/logouts tracked in sessions_utilisateurs

✓ Automatic Cleanup
  └─Sessions > 30 days old deleted


┌─────────────────────────────────────────────────────────────────────────┐
│          ENDPOINTS SUMMARY                                             │
└─────────────────────────────────────────────────────────────────────────┘

Auth Routes (/api/auth/)
├─POST /login → Create session
├─POST /logout → Invalidate session
└─POST /verify-session → Check session validity

Session Routes (/api/sessions/)
├─GET / → List all user sessions
├─GET /:id → Get session details
├─PATCH /:id/logout → Logout one device
├─POST /logout-all → Logout all devices
├─POST /revoke → Revoke by token
├─POST /validate → Validate token (no auth)
├─POST /extend → Keep-alive extension
└─GET /cleanup/expired → Admin cleanup

