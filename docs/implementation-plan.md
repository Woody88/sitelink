# Local Development Setup Plan - Effect-TS HTTP API + Better-Auth + Polar

## Overview

Setting up the Sitelink backend using a **hybrid architecture**:
- **Main Worker**: Effect-TS HTTP API with direct D1/R2 access
- **Processing Service**: Containerized Sharp-based PDF processing
- **Better-Auth** for passwordless authentication (magic link + OAuth)
- **Polar** for subscription management (Merchant of Record)
- **D1 Database** for data storage
- **R2 Storage** for file storage
- **Cloudflare Email Workers** for magic link delivery

## Architectural Decision: Hybrid Approach

**Main Worker (Effect-TS):**
- Handles all HTTP API endpoints, database operations, authentication
- Direct access to Cloudflare bindings (D1, R2, Email, etc.)
- No containers = simpler database access and development

**Image Processing Service (Containerized):**
- Only handles PDF → image conversion and DZI tile generation
- Contains Sharp + native libraries in container
- Triggered by main worker via HTTP/queue
- Returns processed results to R2

## Code Architecture & Folder Structure

### Backend Structure (Effect-TS HTTP API)
```
packages/backend/src/
├── core/                    # Core infrastructure services
│   ├── database.ts          # DrizzleD1Client service
│   ├── auth.ts              # BetterAuthService
│   ├── email.ts             # EmailService (Cloudflare Email Workers)
│   ├── storage.ts           # R2StorageService
│   ├── api.ts               # Base HttpApi definition
│   └── index.ts             # CoreLayer composition
│
├── features/                # Business feature modules
│   ├── health/
│   │   ├── service.ts       # HealthService (business logic)
│   │   ├── http.ts          # HTTP endpoints (HealthAPI)
│   │   └── index.ts         # HealthModule (layer composition)
│   │
│   ├── auth/
│   │   ├── service.ts       # AuthService (magic link, OAuth, sessions)
│   │   ├── http.ts          # AuthAPI (sign-in, sign-out, callback)
│   │   ├── middleware.ts    # requireAuth middleware
│   │   └── index.ts         # AuthModule
│   │
│   ├── organizations/
│   │   ├── service.ts       # OrganizationService (CRUD, invitations, RBAC)
│   │   ├── http.ts          # OrganizationAPI
│   │   └── index.ts         # OrganizationModule
│   │
│   ├── projects/
│   │   ├── service.ts       # ProjectService (CRUD, access control)
│   │   ├── http.ts          # ProjectAPI
│   │   └── index.ts         # ProjectModule
│   │
│   ├── payments/
│   │   ├── service.ts       # PaymentService (Polar integration)
│   │   ├── http.ts          # PaymentAPI (subscriptions, webhooks)
│   │   └── index.ts         # PaymentModule
│   │
│   └── files/
│       ├── service.ts       # FileService (uploads, processing)
│       ├── http.ts          # FileAPI
│       └── index.ts         # FileModule
│
├── db/
│   └── schema.ts            # Drizzle schema definitions (Better-Auth tables)
│
├── api.ts                   # Main SiteLinkApi composition
└── index.ts                 # Cloudflare Worker entry point
```

### Architecture Rules
1. **Core Layer**: Infrastructure services (Database, Auth, Email, Storage, Config)
2. **Feature Modules**: Self-contained business domains following composable pattern
3. **HTTP API**: Uses `@effect/platform` HttpApiBuilder
4. **Layer Composition**: Each feature exports a module layer that declares dependencies
5. **No Cross-Dependencies**: Features only depend on Core, never on each other
6. **Dependency Injection**: CloudflareEnv injected at worker boundary, flows through layers

---

## Phase 1: Foundation & Database (Easiest - 1 day)

**Goal**: Get database schema in place with Better-Auth tables

### 1.1 Update Database Schema
- [x] Update `schema.ts` with Better-Auth core tables:
  - `user` table (id, name, email, emailVerified, image, timestamps)
  - `session` table (id, token, expiresAt, userId, activeOrganizationId)
  - `account` table (OAuth providers: Google, Microsoft)
  - `verification` table (magic link tokens)
- [x] Add Better-Auth organization plugin tables:
  - `organization` table (id, name, slug, logo, deletedAt, metadata)
  - `member` table (organizationId, userId, role)
  - `invitation` table (organizationId, email, role, status, expiresAt)
- [x] Add Polar subscription table:
  - `subscription` table (polarSubscriptionId, organizationId, plan, seats, status)
- [x] Add existing tables:
  - `project`, `plan`, `files`, `medias`, `annotation`, `usageEvents`
- [x] Create D1 migration file
- [x] Run migration on local D1
- [x] Verify schema with `wrangler d1 execute`

### 1.2 Install Dependencies
- [x] Add Better-Auth: `bun add better-auth`
- [x] Add Better-Auth Drizzle adapter: `bun add better-auth/adapters/drizzle`
- [x] Add Polar SDK: `bun add @polar-sh/sdk`
- [x] Verify all dependencies installed correctly

---

## Phase 2: Core Services (Easy - 1 day)

**Goal**: Set up core infrastructure services that features will use

### 2.1 Better-Auth Service (Core)
- [ ] Create `core/auth.ts`
- [ ] Initialize Better-Auth with Drizzle adapter
- [ ] Configure email & password: `enabled: false` (passwordless only)
- [ ] Add organization plugin with limit: 1
- [ ] Export `BetterAuthService` tag
- [ ] Create `BetterAuthServiceLive` layer
- [ ] Test initialization (no errors on startup)

### 2.2 Email Service (Core)
- [ ] Create `core/email.ts`
- [ ] Set up Cloudflare Email Workers binding
- [ ] Create `EmailService` tag with `sendMagicLink` method
- [ ] Create `EmailServiceLive` layer
- [ ] Test with dummy email (use local SMTP for dev)

### 2.3 R2 Storage Service (Core)
- [ ] Create `core/storage.ts`
- [ ] Add R2 binding to `wrangler.jsonc`
- [ ] Create `R2StorageService` tag
- [ ] Implement basic methods: `upload`, `download`, `delete`, `getUrl`
- [ ] Create `R2StorageServiceLive` layer
- [ ] Test with sample file upload/download

### 2.4 Update Core Layer Composition
- [ ] Update `core/index.ts` to export `CoreLayer`
- [ ] Compose all services: `DrizzleD1Client`, `BetterAuthService`, `EmailService`, `R2StorageService`
- [ ] Test CoreLayer builds without errors

---

## Phase 3: Auth Feature Module (Medium - 2 days)

**Goal**: Implement passwordless authentication (magic link + OAuth)

### 3.1 Auth Service
- [ ] Create `features/auth/service.ts`
- [ ] Implement `AuthService` tag with methods:
  - `sendMagicLink(email)` - send magic link via email
  - `verifyMagicLink(token)` - verify token and create session
  - `initiateOAuth(provider)` - redirect URL for Google/Microsoft
  - `handleOAuthCallback(provider, code)` - handle OAuth callback
  - `completeRegistration(userId, userName, orgName, orgLogo)` - first-time setup
  - `verifySession(token)` - verify session and return user + org context
  - `signOut(token)` - invalidate session
  - `switchOrganization(token, orgId)` - change active org
- [ ] Create `AuthServiceLive` layer (depends on Core)

### 3.2 Auth HTTP Endpoints
- [ ] Create `features/auth/http.ts`
- [ ] Implement endpoints:
  - `POST /auth/magic-link` - send magic link
  - `GET /auth/magic-link/verify?token=xxx` - verify magic link
  - `GET /auth/oauth/{provider}/initiate` - start OAuth flow
  - `GET /auth/oauth/{provider}/callback?code=xxx` - OAuth callback
  - `POST /auth/complete-registration` - finish first-time setup
  - `POST /auth/sign-out` - sign out
  - `POST /auth/switch-organization` - switch org
  - `GET /auth/session` - get current session
- [ ] Create `AuthAPI` group with all endpoints
- [ ] Create `AuthAPILive` handler

### 3.3 Auth Middleware
- [ ] Create `features/auth/middleware.ts`
- [ ] Implement `requireAuth` effect that:
  - Extracts `Authorization: Bearer {token}` header
  - Calls `authService.verifySession(token)`
  - Returns `{ userId, organizationId }` or fails with 401
- [ ] Test middleware with valid/invalid tokens

### 3.4 First-Time User Flow
- [ ] Test OAuth flow:
  1. User clicks "Sign in with Google"
  2. Redirect to Google OAuth
  3. Callback creates user if new
  4. If new user: return `isNewUser: true`
  5. Frontend shows "Tell us about your business" form
  6. Call `POST /auth/complete-registration` with org details
  7. Creates organization + membership + trial subscription atomically
  8. Returns session token

### 3.5 Auth Module Composition
- [ ] Create `features/auth/index.ts`
- [ ] Export `AuthModule` layer combining service + HTTP API
- [ ] Test module composes with CoreLayer

---

## Phase 4: Organization Feature Module (Medium - 2 days)

**Goal**: Implement multi-tenant organization management with RBAC

### 4.1 Organization Service
- [ ] Create `features/organizations/service.ts`
- [ ] Implement `OrganizationService` tag with methods:
  - `get(organizationId)` - get org details
  - `update(orgId, userId, data)` - update org (name, logo)
  - `softDelete(orgId, userId)` - mark for deletion
  - `restore(orgId, userId)` - restore within 30 days
  - `hardDelete(orgId)` - permanent deletion (called by queue)
  - `listMembers(orgId)` - get all members with roles
  - `updateMemberRole(orgId, requesterId, targetUserId, newRole)`
  - `removeMember(orgId, requesterId, targetUserId)`
  - `checkPermission(userId, orgId, permission)` - RBAC check
  - `getUserRole(userId, orgId)` - get user's role
  - `createInvitation(orgId, inviterId, email, role)` - send invite
  - `listInvitations(orgId)` - pending invitations
  - `acceptInvitation(invitationId, userId)` - join org
  - `rejectInvitation(invitationId, userId)`
  - `cancelInvitation(invitationId, requesterId)`
  - `resendInvitation(invitationId, requesterId)`
  - `getAvailableSeats(orgId)` - check seat limits
  - `canAddMember(orgId)` - verify seats available
- [ ] Create `OrganizationServiceLive` layer

### 4.2 Organization HTTP Endpoints
- [ ] Create `features/organizations/http.ts`
- [ ] Implement endpoints (all require auth):
  - `GET /organizations/:id`
  - `PATCH /organizations/:id`
  - `DELETE /organizations/:id` - soft delete
  - `POST /organizations/:id/restore`
  - `GET /organizations/:id/members`
  - `PATCH /organizations/:id/members/:userId` - change role
  - `DELETE /organizations/:id/members/:userId` - remove member
  - `POST /organizations/:id/invitations` - create invitation
  - `GET /organizations/:id/invitations` - list invitations
  - `POST /invitations/:id/accept`
  - `POST /invitations/:id/reject`
  - `DELETE /invitations/:id` - cancel
  - `POST /invitations/:id/resend`
  - `GET /organizations/:id/seats` - seat usage
- [ ] Use `requireAuth` middleware on all endpoints
- [ ] Implement RBAC checks before operations

### 4.3 Invitation Email System
- [ ] Design invitation email template
- [ ] Integrate with EmailService to send invitations
- [ ] Test invitation flow end-to-end

### 4.4 Organization Deletion Workflow
- [ ] Implement soft-delete logic (set `deletedAt`)
- [ ] Set up Cloudflare Queue for delayed hard delete
- [ ] Implement hard delete logic:
  - Delete all projects
  - Delete all files in R2
  - Remove memberships
  - Delete users who only belonged to this org
  - Delete organization record
- [ ] Test deletion and restore flow

### 4.5 Organization Module Composition
- [ ] Create `features/organizations/index.ts`
- [ ] Export `OrganizationModule` layer
- [ ] Test module composes with CoreLayer

---

## Phase 5: Payments Feature Module (Easy-Medium - 1 day)

**Goal**: Integrate Polar for subscription management

### 5.1 Polar Service
- [ ] Create `features/payments/service.ts`
- [ ] Initialize Polar SDK with access token
- [ ] Implement `PaymentService` tag with methods:
  - `createSubscription(orgId, plan, seats)` - create via Polar
  - `getSubscription(orgId)` - get current subscription
  - `updateSubscription(orgId, plan?, seats?)` - upgrade/downgrade
  - `cancelSubscription(orgId)` - cancel subscription
  - `handleWebhook(payload)` - process Polar webhooks
- [ ] Store Polar subscription ID in local D1 `subscription` table
- [ ] Use `external_user_id` = organizationId (no customer sync needed)
- [ ] Create `PaymentServiceLive` layer

### 5.2 Payment HTTP Endpoints
- [ ] Create `features/payments/http.ts`
- [ ] Implement endpoints:
  - `POST /subscriptions` - create subscription
  - `GET /organizations/:orgId/subscription` - get subscription
  - `PATCH /organizations/:orgId/subscription` - update subscription
  - `DELETE /organizations/:orgId/subscription` - cancel
  - `POST /webhooks/polar` - handle Polar webhooks
- [ ] Implement webhook signature verification
- [ ] Test webhook handling locally

### 5.3 Trial Subscription Creation
- [ ] Update `auth/completeRegistration` to create trial subscription
- [ ] Set trial duration: 14 days
- [ ] Set trial limits: 2 projects, 3 seats, 1 GB storage
- [ ] Test trial creation on first sign-up

### 5.4 Seat Limit Integration
- [ ] Update `OrganizationService.canAddMember()` to check subscription seats
- [ ] Block invitations when at seat limit
- [ ] Show upgrade prompt when blocked
- [ ] Test seat limit enforcement

### 5.5 Payments Module Composition
- [ ] Create `features/payments/index.ts`
- [ ] Export `PaymentModule` layer
- [ ] Test module composes with CoreLayer

---

## Phase 6: Projects Feature Module (Easy - 1 day)

**Goal**: Basic project CRUD operations

### 6.1 Project Service
- [ ] Create `features/projects/service.ts`
- [ ] Implement `ProjectService` tag with methods:
  - `create(orgId, userId, name, description?)` - create project
  - `get(projectId)` - get project details
  - `list(orgId, userId)` - list all projects in org
  - `update(projectId, userId, data)` - update project
  - `delete(projectId, userId)` - delete project (cascade to plans/files)
  - `verifyAccess(projectId, userId)` - check if user can access
- [ ] Create `ProjectServiceLive` layer

### 6.2 Project HTTP Endpoints
- [ ] Create `features/projects/http.ts`
- [ ] Implement endpoints (all require auth):
  - `POST /projects` - create project
  - `GET /projects/:id` - get project
  - `GET /organizations/:orgId/projects` - list projects
  - `PATCH /projects/:id` - update project
  - `DELETE /projects/:id` - delete project
- [ ] Use `requireAuth` middleware
- [ ] Check organization membership before operations

### 6.3 Projects Module Composition
- [ ] Create `features/projects/index.ts`
- [ ] Export `ProjectModule` layer
- [ ] Test module composes with CoreLayer

---

## Phase 7: Files & Processing (Hard - 3-4 days)

**Goal**: PDF upload, processing, and tile generation

### 7.1 File Upload (HTTP API)
- [ ] Create `features/files/service.ts`
- [ ] Implement file upload via multipart/form-data
- [ ] Validate PDF format and size limits
- [ ] Upload original PDF to R2: `/orgs/{orgId}/projects/{projectId}/plans/{planId}/original.pdf`
- [ ] Create `plan` record in D1 with `processingStatus: pending`
- [ ] Return upload success + plan ID

### 7.2 Processing Service Setup (Containerized)
- [ ] Create `packages/processing/` package
- [ ] Set up Dockerfile with Sharp dependencies
- [ ] Create HTTP endpoint: `POST /process`
  - Accepts: plan ID, R2 path to PDF
  - Returns: processing status
- [ ] Implement PDF → PNG conversion using Sharp
- [ ] Implement DZI tile generation
- [ ] Upload tiles to R2: `/orgs/{orgId}/projects/{projectId}/plans/{planId}/tiles/`
- [ ] Upload thumbnail to R2
- [ ] Test container locally

### 7.3 Processing Integration
- [ ] Add HTTP client in main worker to call processing service
- [ ] Implement Cloudflare Queue for processing jobs
- [ ] Worker receives upload → creates job → enqueues
- [ ] Processing service picks up job → processes → updates D1
- [ ] Update `plan.processingStatus` to `processing`, `complete`, or `failed`
- [ ] Implement retry logic for failed processing
- [ ] Test end-to-end flow

### 7.4 File Service Endpoints
- [ ] Create `features/files/http.ts`
- [ ] Implement endpoints:
  - `POST /projects/:projectId/plans` - upload PDF
  - `GET /plans/:id` - get plan details + processing status
  - `GET /plans/:id/tiles/{z}/{x}/{y}.png` - serve tiles
  - `GET /plans/:id/thumbnail` - serve thumbnail
  - `DELETE /plans/:id` - delete plan + files
- [ ] Test file upload and retrieval

### 7.5 Files Module Composition
- [ ] Create `features/files/index.ts`
- [ ] Export `FileModule` layer
- [ ] Test module composes with CoreLayer

---

## Phase 8: Main API Composition & Testing (Easy - 1 day)

**Goal**: Wire everything together and test the complete API

### 8.1 Main API Composition
- [ ] Update `api.ts` to compose all feature APIs:
  - HealthAPI
  - AuthAPI
  - OrganizationAPI
  - PaymentAPI
  - ProjectAPI
  - FileAPI
- [ ] Create `SiteLinkApi` using `HttpApiBuilder.api()`
- [ ] Add all API groups to SiteLinkApi

### 8.2 App Layer Composition
- [ ] Update `index.ts` (worker entry point)
- [ ] Compose all modules with CoreLayer:
  ```typescript
  const AppLayer = Layer.mergeAll(
    HealthModule,
    AuthModule,
    OrganizationModule,
    PaymentModule,
    ProjectModule,
    FileModule
  ).pipe(Layer.provide(CoreLayer))
  ```
- [ ] Test worker starts without errors

### 8.3 Integration Testing
- [ ] Test complete user flow:
  1. Sign in with OAuth
  2. Complete registration (creates org + trial subscription)
  3. Create project
  4. Upload PDF plan
  5. Wait for processing
  6. View tiles
  7. Invite team member
  8. Accept invitation
  9. Switch organizations
  10. Sign out
- [ ] Test error cases (invalid tokens, insufficient permissions, etc.)
- [ ] Test RBAC (member cannot delete org, admin cannot manage billing, etc.)

### 8.4 Local Development Setup
- [ ] Document environment variables needed
- [ ] Create `.dev.vars` template
- [ ] Document how to run locally: `bun run dev`
- [ ] Document how to test processing service
- [ ] Document how to test webhooks (use ngrok/cloudflared)

---

## Key Architectural Decisions

### Database Schema
- Using Better-Auth tables (user, session, account, verification)
- Using Better-Auth organization plugin tables (organization, member, invitation)
- Polar subscription data synced via webhooks to local D1
- No external API calls from endpoints (all data in D1)

### Authentication Strategy
- **Passwordless Only**: Magic link + OAuth (Google, Microsoft)
- **No Passwords**: Eliminates password management complexity
- **Magic Link**: Primary for on-site workers
- **OAuth**: Primary for business accounts
- **Sessions**: Better-Auth handles session management + active org tracking

### Payment Integration
- **Polar as MoR**: Handles tax compliance (GST/HST, US sales tax)
- **External User ID**: Pass `organizationId` directly (no customer sync)
- **Webhooks**: Polar updates subscription status via webhooks
- **Trial**: 14 days, 2 projects, 3 users, 1 GB storage

### API Design
- **Main Worker**: Effect-TS HTTP API for all business logic
- **HTTP Endpoints**: RESTful API using Effect Platform
- **Authentication**: Better-Auth middleware on protected routes
- **File Uploads**: Multipart uploads with progress tracking

### Processing Strategy
- **Hybrid Architecture**: Main worker (no containers) + Processing service (containerized)
- **Main Worker**: Direct Cloudflare bindings (D1, R2, Email, Queues)
- **Processing Service**: Sharp + native libraries in Docker
- **Communication**: Cloudflare Queue between worker and processing service
- **Storage**: R2 for all files, D1 for metadata only

### Development Workflow
- **Main Worker**: Standard `wrangler dev` with D1/R2/Email bindings
- **Processing Service**: Separate Docker container development
- Local D1 database for testing
- Type-safe HTTP API client generation for mobile app
- Webhook testing with cloudflared tunnel

---

## Success Criteria

### Phase 1 Complete ✅
- [x] Local D1 database operational
- [x] Basic HTTP API endpoints responding
- [x] Health checks passing

### Phase 2 Complete
- [ ] Better-Auth service initialized
- [ ] Email service operational
- [ ] R2 storage working
- [ ] CoreLayer composes successfully

### Phase 3 Complete
- [ ] Magic link authentication working
- [ ] OAuth authentication working (Google, Microsoft)
- [ ] First-time registration creates org + trial
- [ ] Session management working
- [ ] Auth middleware protecting routes

### Phase 4 Complete
- [ ] Organizations CRUD operational
- [ ] Member management working
- [ ] Invitations sending and accepting
- [ ] RBAC enforcing permissions
- [ ] Seat limits enforced

### Phase 5 Complete
- [ ] Polar subscriptions creating
- [ ] Webhooks processing correctly
- [ ] Seat limits tied to subscription
- [ ] Trial subscriptions working

### Phase 6 Complete
- [ ] Projects CRUD operational
- [ ] Access control working
- [ ] Projects scoped to organizations

### Phase 7 Complete
- [ ] PDF upload working
- [ ] Processing service generating tiles
- [ ] Tiles served correctly
- [ ] Error handling and retry working
- [ ] Ready for mobile app integration

### Phase 8 Complete
- [ ] All modules composed and working together
- [ ] Complete user flow tested
- [ ] RBAC tested across all features
- [ ] Local development documented
- [ ] Ready for production deployment

---

## Next Steps After Implementation

1. **Mobile App Integration**: Generate type-safe HTTP client for React Native
2. **Production Deployment**: Deploy to Cloudflare Workers + processing service
3. **Monitoring Setup**: Baselime observability for production
4. **Performance Optimization**: Based on real usage patterns
5. **Feature Expansion**: Sheet linking, annotations, media captures

---

## Open Questions to Resolve Before Starting

1. **OAuth Providers**: Confirm Google + Microsoft are sufficient for MVP (no Apple?)
2. **Magic Link Priority**: Confirm both magic link AND OAuth in Phase 3 (not sequential)
3. **Seat Limits**: Confirm we block invitations when full + show upgrade prompt
4. **Deletion Jobs**: Confirm we use Cloudflare Queues for 30-day deletion workflow
5. **PDF Processing**: Confirm containerized service in `packages/processing`
6. **Email Service**: Confirm Cloudflare Email Workers for production (local SMTP for dev)
