# Testing Strategy: Unit vs Integration Testing

## Overview

This document outlines our testing strategy for the Sitelink project, particularly focusing on the distinction between unit and integration testing in an Effect-TS + Cloudflare Workers architecture.

## Core Principles

### The Architecture Boundary

**Core (Business Logic)**: Services that contain pure business rules, calculations, and domain logic
**Edge (Integration Points)**: HTTP handlers, database connections, external API calls, pub/sub, cron jobs, RPC calls

### Testing Philosophy

- **Unit Tests**: Test the core business logic in isolation with mocked dependencies
- **Integration Tests**: Test the edges and how components work together with real or realistic dependencies

## What Constitutes Unit Testing

### ✅ Valid Unit Test Scenarios

**Pure Business Logic Services:**
```typescript
export class UserService extends Effect.Service<UserService>()("UserService", {
  effect: Effect.gen(function* () {
    const database = yield* DrizzleD1Client

    return {
      calculateSubscriptionRenewal: (user: User, plan: Plan) => Effect.succeed(renewalDate),
      validateUserPermissions: (user: User, resource: Resource) => Effect.succeed(isValid),
      computeUsageMetrics: (activities: Activity[]) => Effect.succeed(metrics)
    }
  })
}) {}
```

**Domain Calculations:**
```typescript
export class PricingService extends Effect.Service<PricingService>()("PricingService", {
  effect: Effect.gen(function* () {
    const userService = yield* UserService

    return {
      calculateDiscount: (user: User, plan: Plan) => Effect.succeed(discount),
      computeTax: (amount: Money, location: Address) => Effect.succeed(tax),
      generateInvoice: (subscription: Subscription) => Effect.succeed(invoice)
    }
  })
}) {}
```

**Data Transformations:**
```typescript
export class ReportService extends Effect.Service<ReportService>()("ReportService", {
  effect: Effect.gen(function* () {
    const database = yield* DrizzleD1Client

    return {
      aggregateMetrics: (rawData: RawMetrics[]) => Effect.succeed(aggregatedReport),
      formatExportData: (data: ExportData, format: ExportFormat) => Effect.succeed(formatted),
      validateReportParameters: (params: ReportParams) => Effect.succeed(validated)
    }
  })
}) {}
```

### Unit Test Characteristics

- **Fast execution** (milliseconds)
- **Isolated** - no external dependencies
- **Deterministic** - same input always produces same output
- **Focused** - tests one specific behavior or calculation
- **Mocked dependencies** - all external services are mocked

### Unit Test Example

```typescript
// test/unit/services/pricing.test.ts
import { test, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { PricingService } from "../../../src/features/pricing/service"
import { UserService } from "../../../src/features/users/service"

test("calculates enterprise discount correctly", async () => {
  const mockUserService = Layer.succeed(UserService, UserService.of({
    getUserTier: () => Effect.succeed("enterprise"),
    validateUserPermissions: () => Effect.succeed(true),
    computeUsageMetrics: () => Effect.succeed({})
  }))

  const program = Effect.gen(function* () {
    const pricingService = yield* PricingService
    return yield* pricingService.calculateDiscount(user, plan)
  })

  const result = await Effect.runPromise(
    program.pipe(
      Effect.provide(PricingService.Default),
      Effect.provide(mockUserService)
    )
  )

  expect(result.percentage).toBe(0.15) // 15% enterprise discount
})
```

## What Constitutes Integration Testing

### ✅ Valid Integration Test Scenarios

**Health/Monitoring Services:**
```typescript
export class HealthService extends Effect.Service<HealthService>()("HealthService", {
  effect: Effect.gen(function* () {
    const db = yield* DrizzleD1Client

    return {
      checkDatabaseConnection: () => Effect.succeed(healthStatus),
      verifyExternalAPIHealth: () => Effect.succeed(healthStatus),
      validateStorageAccess: () => Effect.succeed(healthStatus)
    }
  })
}) {}
```

**HTTP Endpoints:**
```typescript
// Testing the full HTTP pipeline
GET /api/users/:id  // Route parsing, middleware, serialization
POST /api/projects  // Request validation, authentication, response format
```

**External System Integration:**
```typescript
export class EmailService extends Effect.Service<EmailService>()("EmailService", {
  effect: Effect.gen(function* () {
    const config = yield* ConfigService

    return {
      sendNotification: (email: Email) => Effect.succeed(deliveryStatus)  // Real email provider
    }
  })
}) {}

export class PaymentService extends Effect.Service<PaymentService>()("PaymentService", {
  effect: Effect.gen(function* () {
    const config = yield* ConfigService

    return {
      processPayment: (payment: Payment) => Effect.succeed(paymentResult)  // Real payment gateway
    }
  })
}) {}
```

**Database Operations:**
```typescript
export class ProjectRepository extends Effect.Service<ProjectRepository>()("ProjectRepository", {
  effect: Effect.gen(function* () {
    const db = yield* DrizzleD1Client

    return {
      save: (project: Project) => Effect.succeed(project),      // Real database writes
      findByUserId: (userId: string) => Effect.succeed(projects)  // Real database queries
    }
  })
}) {}
```

### Integration Test Characteristics

- **Slower execution** (seconds)
- **Real dependencies** - actual databases, APIs, bindings
- **Environment-dependent** - may behave differently across environments
- **End-to-end flows** - tests complete request/response cycles
- **Runtime verification** - tests Cloudflare Worker constraints and behavior

### Integration Test Example

```typescript
// test/integration/health.test.ts
import { describe, expect, it } from "vitest"
import { SELF } from "cloudflare:test"

describe("Health Endpoints", () => {
  it("returns system health with real database check", async () => {
    const response = await SELF.fetch("https://example.com/health")
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.database.status).toMatch(/healthy|unhealthy|degraded/)
    expect(typeof data.timestamp).toBe("number")
  })
})
```

## Special Cases and Nuanced Scenarios

### Health Services: Integration by Nature

**Why Health Services are Integration Tests:**
- Their purpose is to verify external system connectivity
- Mocking defeats the purpose - you're testing that mocks work
- Real value comes from testing actual integration points
- Failure modes occur at system boundaries

```typescript
// ❌ Not meaningful as a unit test
test("health service with mocked database", () => {
  // Mock always returns success - what are we testing?
})

// ✅ Meaningful as integration test
test("health service detects real database failures", () => {
  // Tests actual connectivity and error handling
})
```

### Repository/Data Access: Usually Integration

**Database repositories should be integration tested:**
```typescript
export class ProjectRepository extends Effect.Service<ProjectRepository>()("ProjectRepository", {
  effect: Effect.gen(function* () {
    const db = yield* DrizzleD1Client

    return {
      // These need real database to test properly
      findByComplexQuery: (filters: ProjectFilters) => Effect.succeed(projects),
      saveWithTransactions: (projects: Project[]) => Effect.succeed(undefined),
      handleConcurrentUpdates: (projectId: string) => Effect.succeed(project)
    }
  })
}) {}
```

**Why:** SQL queries, transactions, concurrency, and database-specific behaviors can't be meaningfully mocked.

### Service Composition: Depends on Purpose

```typescript
// Unit test - pure composition logic
export class ReportService extends Effect.Service<ReportService>()("ReportService", {
  effect: Effect.gen(function* () {
    const userService = yield* UserService
    const metricsService = yield* MetricsService
    const formatService = yield* FormatService

    const generateReport = (userId: string) =>
      Effect.gen(function* () {
        const user = yield* userService.findById(userId)
        const metrics = yield* metricsService.calculate(user.activities)
        return yield* formatService.format(metrics, user.preferences)
      })

    return { generateReport }
  })
}) {}

// Integration test - involves external systems
export class NotificationService extends Effect.Service<NotificationService>()("NotificationService", {
  effect: Effect.gen(function* () {
    const userService = yield* UserService        // Database
    const templateService = yield* TemplateService // File system
    const emailService = yield* EmailService       // External API

    const sendWelcomeEmail = (userId: string) =>
      Effect.gen(function* () {
        const user = yield* userService.findById(userId)
        const template = yield* templateService.load("welcome")
        return yield* emailService.send(user.email, template)
      })

    return { sendWelcomeEmail }
  })
}) {}
```

## Testing Strategy by Layer

### Core Services (Unit Tests)
- Business rule validation
- Complex calculations
- Data transformations
- Algorithm implementations
- Service composition logic

### Feature HTTP APIs (Integration Tests)
- Route handling
- Request/response serialization
- Authentication/authorization flow
- Error handling and status codes

### External Dependencies (Integration Tests)
- Database operations
- File system access
- External API calls
- Message queue operations

## Test Organization

```
test/
├── unit/                    # Fast, isolated tests (bun test)
│   ├── services/
│   │   ├── pricing.test.ts
│   │   ├── user.test.ts
│   │   └── reports.test.ts
│   └── utils/
│       └── calculations.test.ts
│
├── integration/             # Real dependencies (vitest + CF Workers)
│   ├── health.test.ts
│   ├── auth.test.ts
│   └── api/
│       ├── users.test.ts
│       └── projects.test.ts
│
└── e2e/                     # Full system tests (optional)
    └── user-workflows.test.ts
```

## Commands

```bash
# Fast feedback loop - business logic
bun test test/unit/

# Comprehensive verification - integration
bun run vitest test/integration/

# Full test suite
bun run test
```

## Anti-Patterns to Avoid

### ❌ Testing Implementation Details
```typescript
// Don't test internal method calls
expect(mockService.internalMethod).toHaveBeenCalled()
```

### ❌ Redundant Test Coverage
```typescript
// Unit test
test("user service calculates renewal date")

// Integration test (redundant)
test("POST /users/:id/renew calculates renewal date") // Tests same logic
```

### ❌ Mocking Everything in Integration Tests
```typescript
// If everything is mocked, it's not integration testing
const mockDatabase = ...
const mockEmailService = ...
const mockPaymentGateway = ...
```

### ❌ Testing Mocks Instead of Logic
```typescript
// This tests that mocks work, not that logic works
expect(mockService.method()).resolves.toBe("mocked value")
```

## Key Takeaways

1. **Health services are integration concerns** - test them with real dependencies
2. **Service structure ≠ testing strategy** - organize by architectural patterns, test by purpose
3. **Focus unit tests on business logic** - calculations, validations, transformations
4. **Focus integration tests on boundaries** - HTTP, database, external systems
5. **Avoid redundant coverage** - don't test the same logic at multiple levels
6. **Choose tools appropriately** - bun test for units, vitest for CF Workers integration

The goal is fast feedback for business logic changes and comprehensive verification of system integration, without redundant test coverage.