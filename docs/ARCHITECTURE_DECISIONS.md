# Architecture Decisions & Expert Validation

**Date**: January 2025
**Status**: Validated by GPT-4o and Claude 3.7 Sonnet

## Executive Summary

After consultation with multiple AI experts and analysis of our specific requirements (construction plan viewer SaaS for Canada/US market at $49/mo), we have validated the following architecture decisions:

✅ **Better-Auth** for authentication (passwordless: magic link + OAuth)
✅ **Polar** for payments (Merchant of Record model)
✅ **Effect-TS** for backend (with MVP simplifications)
✅ **Composable Module Architecture** (core → features → app)

---

## Key Decisions

### 1. Authentication: Better-Auth (Selected over Clerk)

**Decision**: Use Better-Auth with passwordless authentication (magic link + OAuth).

**Rationale**:
- **No Password Management**: Eliminates security risks and complexity
- **Lower Cost at Scale**: No per-user pricing (vs Clerk's pricing tiers)
- **Native D1 + Drizzle Support**: Perfect fit for Cloudflare stack
- **Multi-Org Plugin**: Built-in organization management
- **Less Vendor Lock-in**: Open source, self-hostable
- **Modern UX**: Passwordless is becoming industry standard

**Authentication Methods**:
1. **Magic Link** (Primary for MVP)
   - Email-based one-time login
   - Uses Cloudflare Email Workers
   - No password storage or reset flows

2. **OAuth Providers** (MVP)
   - Google (primary for small businesses)
   - Microsoft (for larger contractors)

**Expert Validation**:
- **GPT-4o**: "Solid choice if comfortable building some UI components yourself"
- **Claude Sonnet**: "Acceptable for MVP, but implement abstraction layer for migration flexibility"

**Risk Mitigation**:
- Abstract auth behind `AuthService` interface
- All features use service, not Better-Auth directly
- Can swap providers later without rewriting business logic

**Alternatives Considered**:
- **Clerk**: More mature, pre-built UI, higher cost, vendor lock-in
- **Decision**: Better-Auth better aligns with indie SaaS cost structure

---

### 2. Payments: Polar (Selected over Stripe Direct)

**Decision**: Use Polar as Merchant of Record for subscription management.

**Rationale**:
- **Tax Compliance**: Handles GST/HST (Canada) and US state sales tax automatically
- **External User ID**: No customer sync needed (just pass `user.id`)
- **Simpler Integration**: No webhook complexity for basic flows
- **Subscription Management**: Seat-based pricing built-in
- **Uses Stripe Connect**: Same payout coverage as Stripe
- **Lower Development Overhead**: Focus on features, not tax logic

**Key Benefits**:
```typescript
// With Polar - simple
await polar.subscriptions.create({
  external_user_id: user.id,  // That's it
  product_id: env.POLAR_PRO_PRODUCT_ID,
  seats: 1,
})

// With Stripe Direct - complex
const customer = await stripe.customers.create({ email: user.email })
await db.users.update({ stripe_customer_id: customer.id })
const subscription = await stripe.subscriptions.create({
  customer: customer.id,
  items: [{ price: priceId }],
})
// + handle webhooks for sync
// + manage tax compliance separately
```

**Expert Validation**:
- **GPT-4o**: "Good fit for your needs given simplicity and compliance benefits"
- **Claude Sonnet**: "Excellent choice (low risk)"

**Pricing Comparison** (for $10,000 MRR):
- Stripe Direct: ~$290 (2.9%) + tax compliance costs + dev time
- Polar: $400 (4%) all-inclusive

**Trade-off**: Higher transaction fee (4% vs 2.9%), but saves:
- Tax compliance engineering
- Customer sync complexity
- Subscription management UI
- Webhook handling for state sync

**Geographic Coverage**:
- Polar uses Stripe Connect (same coverage)
- Confirmed support for Canada + US
- Handles GST/HST and state sales tax

**Alternatives Considered**:
- **Stripe Direct**: More control, but higher complexity
- **Decision**: Polar's MoR model better for MVP velocity

---

### 3. Backend Architecture: Effect-TS + Composable Modules

**Decision**: Use Effect-TS with simplified composable module architecture for MVP.

**Rationale**:
- **Type Safety**: Full compile-time guarantees across all layers
- **Dependency Injection**: Clean service composition via layers
- **Testability**: Easy to mock services for testing
- **Maintainability**: Clear separation of concerns
- **Scalability**: Easy to add new features without coupling

**Architecture Pattern**:
```
Core Layer (Infrastructure)
  ├─ Database (Drizzle + D1)
  ├─ Auth (Better-Auth)
  ├─ Storage (R2)
  ├─ Email (Cloudflare Email Workers)
  └─ Config

Feature Modules (Business Logic)
  ├─ Auth Module
  ├─ Organization Module
  ├─ Projects Module
  ├─ Files Module
  └─ Payments Module

App Layer (Composition)
  └─ HTTP API (composes all features)
```

**Key Principles**:
1. **No Cross-Dependencies**: Features only depend on core, never each other
2. **Layer Composition**: Use `Layer.provide()` for dependency injection
3. **Service Interfaces**: All features expose service tags
4. **Effect-First**: All operations return `Effect<Success, Error>`

**Expert Validation**:
- **GPT-4o**: "Potential overengineering - evaluate if all layers necessary for MVP"
- **Claude Sonnet**: "Well-structured but may introduce unnecessary complexity - simplify for MVP"

**MVP Simplifications**:
1. ✅ Keep core → features → app pattern
2. ⚠️ Simplify layer boundaries initially
3. ⚠️ Allow pragmatic shortcuts to ship faster
4. ✅ Refactor toward ideal architecture post-MVP

**Cloudflare Workers Considerations**:
- **CPU Time Limits**: 30s (paid) or 10ms (free tier)
- **Risk**: Complex Effect-TS pipelines might hit limits
- **Mitigation**: Profile early, optimize hot paths, offload heavy processing

**Alternatives Considered**:
- **Simpler Node.js**: Faster to ship, less type safety
- **Decision**: Effect-TS worth it for long-term maintainability

---

### 4. Passwordless Authentication (Critical Decision)

**Decision**: No password support - magic link + OAuth only.

**Rationale**:
- **Security**: Eliminates password-related vulnerabilities
- **UX**: Faster login (no password typing on mobile)
- **Simplicity**: No password reset flows, strength requirements, etc.
- **Modern Standard**: Industry trend (Slack, Notion use passwordless)

**Expert Validation**:
- **GPT-4o**: "Modern approach - gather feedback to see if additional methods needed"
- **Claude Sonnet**: "⚠️ Moderate risk - construction industry may be traditional"

**Critical Addition from Experts**:
> "Construction industry tends to be more traditional in technology adoption. Start with **both OAuth and magic link** (not just OAuth)."

**Updated Decision**:
- ✅ OAuth (Google, Microsoft) - for business accounts
- ✅ Magic Link - for on-site workers without Google/Microsoft accounts
- ❌ Passwords - never

**Risk Mitigation**:
- Support both OAuth and magic link from day 1
- Monitor auth success/failure rates
- Add password support only if user feedback demands it

---

### 5. Multi-Org Model

**Decision**: Auto-create organization on first sign-up, user becomes owner.

**Rationale**:
- **Tenant Boundary**: Organization = paying customer
- **Simplified UX**: Users don't need to understand "organizations"
- **Natural Model**: Construction company = organization
- **Billing Alignment**: Subscriptions tied to organizations, not users

**User Model**:
- User can **own 1 organization** (may expand later)
- User can be **invited to multiple organizations**
- Sessions track **active organization context**
- Switching organizations changes context

**First-Time User Flow**:
```
1. User signs in with Google OAuth
2. If new user: Show "Tell us about your business"
3. Collect: user name + organization name + logo (optional)
4. Create user + organization atomically
5. Set user as organization owner
6. Create trial subscription
7. Login with session + active organization
```

**Expert Validation**:
- **GPT-4o**: "Reasonable approach - ensure clear onboarding"
- **Claude Sonnet**: "Low risk - aligns with business model"

**Role-Based Access**:
- **Owner**: Delete org, manage billing, manage members/projects
- **Admin**: Manage members/projects (not billing)
- **Member**: View projects, upload files

---

### 6. Organization Deletion (30-Day Recovery)

**Decision**: Soft-delete with 30-day recovery window.

**Rationale**:
- **Prevent Mistakes**: Owner can accidentally delete organization
- **Customer Support**: Time to help recover from errors
- **Data Retention**: Comply with potential regulatory requirements

**Deletion Flow**:
```
Day 0: Owner deletes org
  → Set deletedAt timestamp
  → Schedule cleanup job (+30 days)
  → Block new projects/files
  → Show warning banner to members

Days 1-30: Recovery window
  → Owner can restore
  → Data intact, just inaccessible

Day 30: Hard delete
  → Delete all projects
  → Delete all files in R2
  → Remove memberships
  → Delete users who only belonged to this org
  → Delete organization record
```

**Implementation**:
- Use **Cloudflare Queues** with delayed messages
- Alternative: Cron Triggers (check daily for expired deletions)

---

## Risk Assessment & Mitigation

### Risk 1: Better-Auth Maturity (MODERATE)

**Risk**: Better-Auth is newer, may have edge-case bugs.

**Mitigation**:
- ✅ Abstract behind `AuthService` interface
- ✅ Thorough testing of multi-org plugin
- ✅ Monitor auth success/failure rates
- ✅ Plan migration path to Clerk if needed

**Impact**: Medium
**Likelihood**: Low
**Severity**: Can migrate if critical issues found

---

### Risk 2: Cloudflare Worker Execution Limits (MODERATE)

**Risk**: Complex Effect-TS pipelines might hit 30s CPU limit.

**Mitigation**:
- ✅ Profile performance early in development
- ✅ Optimize hot paths
- ✅ Offload PDF processing to containerized service
- ✅ Monitor execution times in production

**Impact**: Medium
**Likelihood**: Medium
**Severity**: Can refactor slow endpoints

---

### Risk 3: Passwordless Adoption Friction (LOW-MODERATE)

**Risk**: Construction workers may resist passwordless auth.

**Mitigation**:
- ✅ Support both magic link and OAuth (not just OAuth)
- ✅ Clear onboarding explaining auth flow
- ✅ Monitor bounce rates on auth pages
- ✅ Add password support if feedback demands it

**Impact**: Medium
**Likelihood**: Low
**Severity**: Easy to add passwords later if needed

---

### Risk 4: PDF Processing Complexity (HIGH - Not Yet Addressed)

**Risk**: Large construction PDFs (50-200MB) exceed Worker limits.

**Issue**: PRD doesn't specify where PDF → tile conversion happens.

**Options**:
1. **Cloudflare Worker**: ❌ CPU time limits too restrictive
2. **Containerized Service**: ✅ Recommended (packages/processing)
3. **Third-Party API**: ⚠️ Adds cost, vendor dependency

**Recommendation**: Use separate containerized service (already in monorepo plan).

**Mitigation**:
- ✅ Sharp library for image processing
- ✅ Queue-based processing (upload → queue → process → notify)
- ✅ Progress tracking in database

---

## Architecture Validation Summary

| Decision | Risk Level | Expert Consensus | Status |
|----------|-----------|------------------|--------|
| Better-Auth | Moderate | Acceptable with abstraction | ✅ Approved |
| Polar | Low | Excellent fit | ✅ Approved |
| Effect-TS | Low-Moderate | Good but simplify for MVP | ✅ Approved* |
| Passwordless | Moderate | Add magic link immediately | ✅ Approved* |
| Multi-Org | Low | Aligns with business model | ✅ Approved |
| PDF Processing | High | Not specified - needs design | ⚠️ TODO |

**\* = with modifications**

---

## Open Questions Requiring Decisions

### 1. Magic Link Priority

**Question**: Should magic link be available from day 1, or start with OAuth only?

**Expert Recommendation**: Add both immediately (construction industry may prefer magic link).

**Decision Needed**: Confirm both are MVP scope.

---

### 2. Seat Limit Enforcement

**Question**: When organization reaches seat limit, should we:
- A) Block invitations with error + upgrade prompt?
- B) Allow sending but queue pending upgrade?
- C) Allow sending but show warning?

**Recommendation**: Option A (block with upgrade prompt).

**Decision Needed**: Confirm enforcement strategy.

---

### 3. Deletion Job Implementation

**Question**: For 30-day deletion workflow, use:
- A) Cloudflare Queues (delayed messages)?
- B) Cloudflare Cron Triggers (daily check)?
- C) Durable Objects (stateful tracking)?

**Recommendation**: Option A (Cloudflare Queues).

**Decision Needed**: Confirm implementation approach.

---

### 4. PDF Processing Architecture

**Question**: Where does PDF → tile conversion happen?

**Options**:
- A) Cloudflare Worker (limited CPU time)
- B) Containerized service (packages/processing)
- C) Third-party API (Adobe PDF Services, etc.)

**Recommendation**: Option B (containerized service).

**Decision Needed**: Confirm PDF processing design.

---

## Next Steps

1. ✅ Update PRD with Better-Auth + Polar decisions
2. ✅ Update database schema (Better-Auth tables)
3. ✅ Create FEATURE_MODULES.md specification
4. ⏳ Answer open questions above
5. ⏳ Design PDF processing architecture
6. ⏳ Begin Phase 2 implementation (Auth + Organization modules)

---

## References

- **Better-Auth Docs**: https://www.better-auth.com/docs
- **Polar Docs**: https://docs.polar.sh
- **Effect-TS Docs**: https://effect.website
- **Cloudflare Workers Limits**: https://developers.cloudflare.com/workers/platform/limits/
- **Expert Validation**: GPT-4o and Claude 3.7 Sonnet (via Zen MCP)
