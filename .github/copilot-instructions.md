# ProjetWebIGL3 - AI Coding Agent Instructions

## Project Overview

**LivraXpress**: A full-stack delivery management platform with multi-role support (client, fournisseur, livreur, admin).

**Architecture**: 
- **Backend**: Express.js (Node.js) + PostgreSQL, port 3000
- **Frontend**: Angular 20 (standalone components), port 4200
- **Authentication**: Session-based with token validation in DB

---

## Key Architecture Patterns

### 1. Authentication & Authorization Flow

**Backend Auth** (`api-express/middleware/auth.middleware.js`):
- Session tokens stored in `sessions_utilisateurs` table (linked to users via `utilisateur_id`)
- Token can come from: Authorization header (`Bearer <token>`), body, or query params
- Token must be active and non-expired: `est_active=true AND date_expiration > NOW()`
- Returns user object with `id`, `role`, `email`, `nom_complet`, `statut`, `photo_profil`
- Role-based access via `checkRole(...roles)` middleware factory

**Frontend Auth** (`LivraXpress/src/app/services/authentification.ts`):
- `AuthService` manages `currentUser` BehaviorSubject stored in sessionStorage
- Token stored as `session_token` in sessionStorage
- `AuthInterceptor` automatically adds `Authorization: Bearer ${token}` to all HTTP requests
- 401 errors trigger logout and redirect to login
- 403 errors redirect to role-based dashboards (`/{role}/dashboard`)

**Guards** (`LivraXpress/src/app/core/guards/`):
- `AuthGuard`: Checks if user is logged in; redirects to `/login` with returnUrl
- `RoleGuard`: Validates route `data.role` matches `currentUser.role`

### 2. Role-Based User Types

Each role has specific registration logic in `api-express/routes/auth.routes.js` with additional data creation:

- **client**: Only basic user record
- **livreur**: Creates `livreurs` record with `type_vehicule`, `numero_permis`
- **fournisseur**: Creates `fournisseurs` record with `nom_entreprise`, `type_fournisseur`, and `adresses` (with PostGIS coordinates)
- **admin**: Only basic user record

**Key Pattern**: Registration is transactional (`BEGIN/COMMIT/ROLLBACK`) to ensure role-specific tables stay in sync.

### 3. Frontend Component Structure

**Pattern**: Each component is standalone (no NgModule declarations). Components are typically organized as:

```
[feature]/
  [feature].ts          (component class with @Component decorator)
  [feature].html        (template)
  [feature].css         (styles)
  [feature].spec.ts     (tests)
```

**Routing**: Standalone routes in `app.routes.ts` with lazy-loaded route guards.

**Services** (`services/`): Injected services for HTTP calls and state management (BehaviorSubjects for observable state).

### 4. HTTP Communication

- **Base URL**: Backend at `http://localhost:3000/api/`
- **CORS**: Configured in `api-express/server.js` for `http://localhost:4200` with credentials
- **Request/Response Format**: JSON with `{ success: boolean, message: string, data?: any }`
- **Error Handling**: Centralized in `AuthInterceptor` with `ToastService` notifications

### 5. File Upload Handling

**Backend** (`api-express/server.js`):
- `express-fileupload` middleware configured with 5MB limit
- Files served from `/uploads` static directory
- Parent paths created automatically

---

## Development Commands

### Frontend (Angular)

```bash
cd LivraXpress
npm start                # Start dev server (port 4200)
npm run build           # Production build
npm test                # Run unit tests (Karma + Jasmine)
ng generate component [name]  # Scaffold component
```

### Backend (Express)

```bash
cd api-express
npm install             # Install dependencies
node server.js          # Start server (port 3000)
```

**Note**: No test script defined yet; consider adding Jest or Mocha.

---

## Database & External Dependencies

**PostgreSQL** (`api-express/config/database.js`):
- Connection: `postgres:5432` (hardcoded credentials - should use `.env`)
- Database: `LivraXpress`
- Key tables: `utilisateurs`, `sessions_utilisateurs`, `clients`, `livreurs`, `fournisseurs`, `adresses` (with PostGIS for coordinates)

**Key Dependencies**:
- **Backend**: bcrypt (password hashing), uuid, express-validator, helmet, compression
- **Frontend**: @angular/material, @angular/cdk, leaflet (mapping), rxjs

---

## Project Conventions

### Naming
- **Database columns**: snake_case (`nom_complet`, `mot_de_passe`)
- **TypeScript properties**: camelCase in models, but snake_case in API responses (watch for mismatches!)
- **Routes**: `/api/{resource}` pattern (auth, notifications, commandes, utilisateurs)

### Code Style
- **Frontend**: Prettier configured for 100-char line width, single quotes, Angular HTML parser
- **Backend**: No explicit linting configured (add ESLint if enforcing)

### Transaction Safety
- Multi-step operations (e.g., user registration with role-specific tables) use DB transactions to prevent inconsistency

---

## Common Development Workflows

### Adding a New Route to the API

1. Create route file in `api-express/routes/[resource].routes.js`
2. Use `authMiddleware` and `checkRole(...)` for protected endpoints
3. Return JSON with `{ success: boolean, message: string, data?: any }`
4. Register route in `server.js` as `app.use('/api/[resource]', routeModule)`

### Adding a New Component to the Frontend

1. Run `ng generate component [feature-name]` or create manually
2. Inject services via constructor for HTTP calls and state management
3. Use `AuthInterceptor` for automatic token attachment
4. Handle 401/403 errors (caught automatically by interceptor)
5. Add route to `app.routes.ts` with guards as needed

### Modifying Authentication

- **Backend**: Update `sessions_utilisateurs` query logic in `auth.middleware.js`
- **Frontend**: Sync changes to `AuthService` and `AuthInterceptor` token extraction
- **Guards**: Update `AuthGuard` or `RoleGuard` if permission logic changes

---

## Critical Files Reference

| Purpose | File | Notes |
|---------|------|-------|
| Server setup | `api-express/server.js` | Routes registration, middleware config |
| Database | `api-express/config/database.js` | PostgreSQL connection pool |
| Auth logic | `api-express/middleware/auth.middleware.js` | Token validation, role checks |
| Registration | `api-express/routes/auth.routes.js` | Role-specific user creation (transactional) |
| Frontend app | `LivraXpress/src/app/app.ts` | Root component, HTTP interceptor setup |
| Auth service | `LivraXpress/src/app/services/authentification.ts` | User state, login/logout |
| Route guards | `LivraXpress/src/app/core/guards/{auth,role}.guard.ts` | Access control |
| Routes config | `LivraXpress/src/app/app.routes.ts` | Standalone route definitions |

---

## Known Issues / Tech Debt

- Database credentials hardcoded (should use `.env` file)
- Backend missing test suite (suggest Jest)
- No API documentation (consider Swagger/OpenAPI)
- Frontend-backend snake_case/camelCase mismatch requires careful mapping
