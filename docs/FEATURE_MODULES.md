# Feature Modules Specification

## Overview

This document defines the exact requirements, responsibilities, and service interfaces for each feature module in the Sitelink backend. The architecture follows a **composable module pattern** where features only depend on core infrastructure services, never on each other.

**Architecture Layers:**
```
Core Layer (Infrastructure)
    ↓
Feature Modules (Business Logic)
    ↓
App Layer (Composition)
```

---

## Core Layer

### Responsibilities
- Database connection (Drizzle + D1)
- Better-Auth service initialization
- R2 storage client
- Email service (Cloudflare Email Workers)
- Configuration management

### Services Provided
- `DrizzleD1Client`
- `BetterAuthService`
- `R2StorageService`
- `EmailService`
- `ConfigService`

### Dependencies
None - core infrastructure only

---

## Auth Feature Module

### Goal
Manage user authentication lifecycle and provide session verification for other modules.

### Exact Requirements

#### What Auth Module MUST Do

1. **Magic Link Sign-In** (Primary MVP Flow)
   - Send magic link email via Cloudflare Email Workers
   - Verify magic link token
   - Create session on successful verification

2. **OAuth Sign-In** (Google + Microsoft)
   - Initiate OAuth flow (redirect to provider)
   - Handle OAuth callback
   - Create/link user account
   - Create session with organization context

3. **First-Time User Registration**
   - After OAuth success, check if user is new
   - If new user:
     - Collect user info (name, email from OAuth)
     - Collect organization info (business name, optional logo)
     - Create user + organization **atomically** (transaction)
     - Set user as organization owner
     - Create session with active organization

4. **Sign Out**
   - Invalidate user session
   - Clear session token

5. **Session Management**
   - Verify session tokens
   - Provide current user + active organization context
   - Handle session expiration
   - Support organization switching

#### What Auth Module Does NOT Do
- Password management (no passwords at all)
- Password reset (not applicable)
- User profile updates (beyond initial registration)
- Organization management (delegates to Organization module)
- Permission checking (delegates to Organization module)

### Service Interface

```typescript
export class AuthService extends Context.Tag("AuthService")<
  AuthService,
  {
    // Magic link flow
    readonly sendMagicLink: (email: string) => Effect.Effect<void, Error>

    readonly verifyMagicLink: (token: string) => Effect.Effect<
      { userId: string; sessionToken: string },
      Error
    >

    // OAuth flow
    readonly initiateOAuth: (
      provider: "google" | "microsoft"
    ) => Effect.Effect<{ redirectUrl: string }, Error>

    readonly handleOAuthCallback: (params: {
      provider: "google" | "microsoft"
      code: string
    }) => Effect.Effect<
      { userId: string; sessionToken: string; isNewUser: boolean },
      Error
    >

    // First-time user registration
    readonly completeRegistration: (params: {
      userId: string
      userName: string
      organizationName: string
      organizationLogo?: string
    }) => Effect.Effect<
      { userId: string; organizationId: string },
      Error
    >

    // Session management
    readonly verifySession: (token: string) => Effect.Effect<
      { userId: string; organizationId: string },
      Error
    >

    readonly signOut: (token: string) => Effect.Effect<void, Error>

    readonly switchOrganization: (params: {
      sessionToken: string
      organizationId: string
    }) => Effect.Effect<void, Error>
  }
>() {}
```

### HTTP Endpoints

```typescript
POST /auth/magic-link
  Body: { email: string }
  Response: { success: true, message: "Check your email" }

GET /auth/magic-link/verify?token=xxx
  Response: { sessionToken: string, isNewUser: boolean }

GET /auth/oauth/{provider}/initiate
  Response: { redirectUrl: string }

GET /auth/oauth/{provider}/callback?code=xxx
  Response: { sessionToken: string, isNewUser: boolean }

POST /auth/complete-registration
  Headers: Authorization: Bearer {sessionToken}
  Body: { userName: string, organizationName: string, organizationLogo?: string }
  Response: { userId: string, organizationId: string }

POST /auth/sign-out
  Headers: Authorization: Bearer {sessionToken}
  Response: { success: true }

POST /auth/switch-organization
  Headers: Authorization: Bearer {sessionToken}
  Body: { organizationId: string }
  Response: { success: true }

GET /auth/session
  Headers: Authorization: Bearer {sessionToken}
  Response: { user: User, organization: Organization }
```

### Dependencies
- Core: `DrizzleD1Client`, `BetterAuthService`, `EmailService`

---

## Organization Feature Module

### Goal
Manage multi-tenant organization structure with role-based access and invitation system.

### Exact Requirements

#### What Organization Module MUST Do

1. **Organization CRUD**
   - Get organization details
   - Update organization (name, logo, metadata)
   - Soft-delete organization (mark for deletion, trigger 30-day workflow)
   - Restore organization (within 30-day window)
   - Hard-delete organization (after 30 days, cascade delete everything)

2. **Membership Management**
   - List organization members with roles
   - Update member role (owner/admin/member)
   - Remove member from organization
   - Check if user belongs to organization

3. **Role-Based Permissions**
   - **Owner**:
     - Delete organization
     - Manage subscription/billing
     - Manage members (add/remove/change roles)
     - Manage projects
     - Upload/view files
   - **Admin**:
     - Manage members (add/remove, change roles except owner)
     - Manage projects
     - Upload/view files
   - **Member**:
     - View projects
     - Upload files
     - View files

4. **Invitation System**
   - Create invitation (email + role)
   - Send invitation email via Email Service
   - List pending invitations
   - Accept invitation (create membership)
   - Reject invitation
   - Cancel invitation (by owner/admin)
   - Resend invitation
   - Check seat limits before creating invitation

5. **Seat Limit Enforcement**
   - Check available seats based on subscription
   - Prevent invitation if at seat limit
   - Count active members against seat limit
   - Return seat usage info

6. **Organization Deletion Workflow**
   - Soft-delete: Set `deletedAt` timestamp
   - Schedule cleanup job for 30 days later (Cloudflare Queues)
   - During 30-day window:
     - Block new projects/files
     - Allow restore by owner
     - Show warning to members
   - After 30 days (hard delete):
     - Delete all projects (via Projects module)
     - Delete all files in R2 (via Files module)
     - Remove all memberships
     - Delete users who only belonged to this org
     - Delete organization record

#### What Organization Module Does NOT Do
- Create first organization (Auth module handles during registration)
- Manage projects directly (delegates to Projects module)
- Manage files directly (delegates to Files module)
- Handle subscription/billing logic (delegates to Payments module)
- Send actual emails (uses Email service from Core)

### Service Interface

```typescript
export type Role = "owner" | "admin" | "member"

export type Permission =
  | "org:delete"
  | "org:update"
  | "org:manage_billing"
  | "members:add"
  | "members:remove"
  | "members:change_role"
  | "projects:create"
  | "projects:update"
  | "projects:delete"
  | "files:upload"
  | "files:view"

export class OrganizationService extends Context.Tag("OrganizationService")<
  OrganizationService,
  {
    // Organization management
    readonly get: (organizationId: string) => Effect.Effect<
      {
        id: string
        name: string
        slug: string | null
        logo: string | null
        createdAt: Date
        deletedAt: Date | null
        metadata: Record<string, unknown> | null
      },
      Error
    >

    readonly update: (params: {
      organizationId: string
      userId: string
      data: { name?: string; logo?: string; metadata?: Record<string, unknown> }
    }) => Effect.Effect<void, Error>

    readonly softDelete: (params: {
      organizationId: string
      userId: string
    }) => Effect.Effect<void, Error>

    readonly restore: (params: {
      organizationId: string
      userId: string
    }) => Effect.Effect<void, Error>

    readonly hardDelete: (
      organizationId: string
    ) => Effect.Effect<void, Error>

    // Membership management
    readonly listMembers: (
      organizationId: string
    ) => Effect.Effect<
      Array<{
        userId: string
        userName: string
        email: string
        role: Role
        joinedAt: Date
      }>,
      Error
    >

    readonly updateMemberRole: (params: {
      organizationId: string
      requesterId: string
      targetUserId: string
      newRole: Role
    }) => Effect.Effect<void, Error>

    readonly removeMember: (params: {
      organizationId: string
      requesterId: string
      targetUserId: string
    }) => Effect.Effect<void, Error>

    // Permissions
    readonly checkPermission: (params: {
      userId: string
      organizationId: string
      permission: Permission
    }) => Effect.Effect<boolean, Error>

    readonly getUserRole: (params: {
      userId: string
      organizationId: string
    }) => Effect.Effect<Role, Error>

    // Invitations
    readonly createInvitation: (params: {
      organizationId: string
      inviterId: string
      email: string
      role: Role
    }) => Effect.Effect<{ invitationId: string }, Error>

    readonly listInvitations: (
      organizationId: string
    ) => Effect.Effect<
      Array<{
        id: string
        email: string
        role: Role
        status: "pending" | "accepted" | "rejected"
        expiresAt: Date
        inviterName: string
      }>,
      Error
    >

    readonly acceptInvitation: (params: {
      invitationId: string
      userId: string
    }) => Effect.Effect<{ organizationId: string }, Error>

    readonly rejectInvitation: (params: {
      invitationId: string
      userId: string
    }) => Effect.Effect<void, Error>

    readonly cancelInvitation: (params: {
      invitationId: string
      requesterId: string
    }) => Effect.Effect<void, Error>

    readonly resendInvitation: (params: {
      invitationId: string
      requesterId: string
    }) => Effect.Effect<void, Error>

    // Seat management
    readonly getAvailableSeats: (
      organizationId: string
    ) => Effect.Effect<
      { total: number; used: number; available: number },
      Error
    >

    readonly canAddMember: (
      organizationId: string
    ) => Effect.Effect<boolean, Error>
  }
>() {}
```

### HTTP Endpoints

```typescript
GET /organizations/:id
  Headers: Authorization: Bearer {sessionToken}
  Response: Organization

PATCH /organizations/:id
  Headers: Authorization: Bearer {sessionToken}
  Body: { name?: string, logo?: string, metadata?: object }
  Response: { success: true }

DELETE /organizations/:id
  Headers: Authorization: Bearer {sessionToken}
  Response: { success: true, deletionScheduledFor: Date }

POST /organizations/:id/restore
  Headers: Authorization: Bearer {sessionToken}
  Response: { success: true }

GET /organizations/:id/members
  Headers: Authorization: Bearer {sessionToken}
  Response: { members: Member[] }

PATCH /organizations/:id/members/:userId
  Headers: Authorization: Bearer {sessionToken}
  Body: { role: Role }
  Response: { success: true }

DELETE /organizations/:id/members/:userId
  Headers: Authorization: Bearer {sessionToken}
  Response: { success: true }

POST /organizations/:id/invitations
  Headers: Authorization: Bearer {sessionToken}
  Body: { email: string, role: Role }
  Response: { invitationId: string }

GET /organizations/:id/invitations
  Headers: Authorization: Bearer {sessionToken}
  Response: { invitations: Invitation[] }

POST /invitations/:id/accept
  Headers: Authorization: Bearer {sessionToken}
  Response: { organizationId: string }

POST /invitations/:id/reject
  Headers: Authorization: Bearer {sessionToken}
  Response: { success: true }

DELETE /invitations/:id
  Headers: Authorization: Bearer {sessionToken}
  Response: { success: true }

POST /invitations/:id/resend
  Headers: Authorization: Bearer {sessionToken}
  Response: { success: true }

GET /organizations/:id/seats
  Headers: Authorization: Bearer {sessionToken}
  Response: { total: number, used: number, available: number }
```

### Dependencies
- Core: `DrizzleD1Client`, `EmailService`
- Subscription info from Payments module (via database query, not direct dependency)

---

## Projects Feature Module

### Goal
Manage construction projects within organizations.

### Exact Requirements

#### What Projects Module MUST Do

1. **Project CRUD**
   - Create project (requires organization context)
   - Get project details
   - List projects for organization
   - Update project (name, description)
   - Delete project (cascade delete plans and files)

2. **Access Control**
   - Verify user has access to project (via organization membership)
   - Check if project belongs to organization

3. **Soft Delete Support**
   - Block operations if organization is soft-deleted

#### What Projects Module Does NOT Do
- Manage organization access (delegates to Organization module)
- Manage file uploads (delegates to Files module)
- Handle plan processing (delegates to Plans module)

### Service Interface

```typescript
export class ProjectService extends Context.Tag("ProjectService")<
  ProjectService,
  {
    readonly create: (params: {
      organizationId: string
      userId: string
      name: string
      description?: string
    }) => Effect.Effect<{ projectId: string }, Error>

    readonly get: (projectId: string) => Effect.Effect<
      {
        id: string
        name: string
        description: string | null
        organizationId: string
        createdAt: Date
        updatedAt: Date
      },
      Error
    >

    readonly list: (params: {
      organizationId: string
      userId: string
    }) => Effect.Effect<
      Array<{
        id: string
        name: string
        description: string | null
        createdAt: Date
        updatedAt: Date
      }>,
      Error
    >

    readonly update: (params: {
      projectId: string
      userId: string
      data: { name?: string; description?: string }
    }) => Effect.Effect<void, Error>

    readonly delete: (params: {
      projectId: string
      userId: string
    }) => Effect.Effect<void, Error>

    readonly verifyAccess: (params: {
      projectId: string
      userId: string
    }) => Effect.Effect<boolean, Error>
  }
>() {}
```

### HTTP Endpoints

```typescript
POST /projects
  Headers: Authorization: Bearer {sessionToken}
  Body: { name: string, description?: string }
  Response: { projectId: string }

GET /projects/:id
  Headers: Authorization: Bearer {sessionToken}
  Response: Project

GET /organizations/:orgId/projects
  Headers: Authorization: Bearer {sessionToken}
  Response: { projects: Project[] }

PATCH /projects/:id
  Headers: Authorization: Bearer {sessionToken}
  Body: { name?: string, description?: string }
  Response: { success: true }

DELETE /projects/:id
  Headers: Authorization: Bearer {sessionToken}
  Response: { success: true }
```

### Dependencies
- Core: `DrizzleD1Client`
- Organization module (for access control checks)

---

## Payments Feature Module

### Goal
Manage subscriptions, billing, and seat limits via Polar integration.

### Exact Requirements

#### What Payments Module MUST Do

1. **Subscription Management**
   - Create subscription (via Polar)
   - Get subscription status
   - Update subscription (change plan, add seats)
   - Cancel subscription
   - Reactivate subscription

2. **Webhook Handling**
   - Handle Polar webhooks (subscription created, updated, canceled)
   - Update local subscription records
   - Trigger organization limits enforcement

3. **Seat Management**
   - Get seat limits for organization
   - Check if seats available
   - Update seat count

4. **Trial Management**
   - Create trial subscription (14 days)
   - Track trial expiration
   - Convert trial to paid

#### What Payments Module Does NOT Do
- Enforce seat limits (Organization module does this)
- Manage organization deletion
- Handle user invitations

### Service Interface

```typescript
export class PaymentService extends Context.Tag("PaymentService")<
  PaymentService,
  {
    readonly createSubscription: (params: {
      organizationId: string
      plan: "trial" | "pro" | "enterprise"
      seats: number
    }) => Effect.Effect<{ subscriptionId: string }, Error>

    readonly getSubscription: (
      organizationId: string
    ) => Effect.Effect<
      {
        id: string
        polarSubscriptionId: string
        plan: string
        status: string
        seats: number
        trialEndsAt: Date | null
        currentPeriodEndsAt: Date
      },
      Error
    >

    readonly updateSubscription: (params: {
      organizationId: string
      plan?: "pro" | "enterprise"
      seats?: number
    }) => Effect.Effect<void, Error>

    readonly cancelSubscription: (
      organizationId: string
    ) => Effect.Effect<void, Error>

    readonly handleWebhook: (
      payload: unknown
    ) => Effect.Effect<void, Error>
  }
>() {}
```

### HTTP Endpoints

```typescript
POST /subscriptions
  Headers: Authorization: Bearer {sessionToken}
  Body: { plan: string, seats: number }
  Response: { subscriptionId: string }

GET /organizations/:orgId/subscription
  Headers: Authorization: Bearer {sessionToken}
  Response: Subscription

PATCH /organizations/:orgId/subscription
  Headers: Authorization: Bearer {sessionToken}
  Body: { plan?: string, seats?: number }
  Response: { success: true }

DELETE /organizations/:orgId/subscription
  Headers: Authorization: Bearer {sessionToken}
  Response: { success: true }

POST /webhooks/polar
  Headers: X-Polar-Signature: {signature}
  Body: PolarWebhookPayload
  Response: { success: true }
```

### Dependencies
- Core: `DrizzleD1Client`
- Polar SDK

---

## Module Interaction Flows

### 1. First-Time User Registration

```
User → Auth: initiateOAuth("google")
Auth → Google: Redirect
Google → Auth: Callback with code
Auth → Better-Auth: handleOAuthCallback()
Better-Auth → Auth: { userId, isNewUser: true }

If isNewUser:
  User → Frontend: Show business info form
  Frontend → Auth: completeRegistration({
    userId,
    userName,
    organizationName
  })
  Auth → Database: BEGIN TRANSACTION
  Auth → Database: CREATE organization
  Auth → Database: CREATE member (user as owner)
  Auth → Payments: createSubscription({ plan: "trial" })
  Auth → Database: COMMIT
  Auth → User: { sessionToken, organizationId }
```

### 2. Invitation Flow

```
Owner → Organization: createInvitation({ email, role })
Organization → Payments: canAddMember()
Payments → Organization: true (seats available)
Organization → Database: CREATE invitation
Organization → Email: Send invitation
Email → New User: Invitation email

New User → Auth: Click link → OAuth flow
Auth → Organization: acceptInvitation({ invitationId, userId })
Organization → Database: CREATE member
Organization → User: { organizationId }
```

### 3. Organization Deletion Flow

```
Owner → Organization: softDelete({ organizationId })
Organization → Database: UPDATE organization SET deletedAt = NOW()
Organization → Queue: Schedule hard delete (+30 days)

After 30 days:
Queue → Organization: hardDelete({ organizationId })
Organization → Projects: deleteAllProjects()
Projects → Files: deleteAllFiles()
Files → R2: Delete objects
Organization → Database: DELETE members
Organization → Database: DELETE users (where org count = 1)
Organization → Database: DELETE organization
```

---

## Questions Requiring Clarification

### 1. Magic Link vs OAuth Priority
Should magic link be available from day 1, or start with OAuth only and add magic link in Phase 2?

**Recommendation:** Start with both (expert feedback emphasized this for construction industry).

### 2. Organization Limit Enforcement
User can create 1 org but can be invited to others. Should the system:
- Hard-block creating a second org? (return error)
- Hide "Create Organization" button but allow invitations?

**Recommendation:** Hide button, soft-enforce (log attempts).

### 3. Seat Limit When Full
When organization reaches seat limit:
- Block sending invitations with error message?
- Allow sending but show upgrade prompt?
- Queue invitations pending upgrade?

**Recommendation:** Block with upgrade prompt.

### 4. Deletion Job Implementation
For 30-day deletion workflow, use:
- Cloudflare Queues?
- Cloudflare Cron Triggers?
- Durable Objects?

**Recommendation:** Cloudflare Queues with delayed messages.

### 5. PDF Processing Architecture
Where does PDF → tile conversion happen?
- Cloudflare Worker (limited CPU time)?
- Separate containerized service?
- Third-party API (e.g., Adobe PDF Services)?

**Recommendation:** Separate containerized service (packages/processing).
