# 02 — Integration Plugin Architecture: OAuth, Credentials & Generated Settings UI

**Status**: DESIGN — Needs implementation planning
**Prerequisite context**: [init.md](./init.md) → read README.md and state.md first

---

## Problem Statement

Apps built and deployed on Brick need to plug into the existing ecosystem of third-party services — Calendly for scheduling, Stripe for payments, Google Calendar for availability, SendGrid for email. Today we have a port-based integration registry (`src/integrations/registry.ts`) with typed input/output contracts for Calendly and Cal.com, but **no mechanism for**:

1. **End-users of deployed apps** to link their own third-party accounts (e.g., a coach connecting their Calendly)
2. **OAuth flows** to be generated into the deployed app's code artifact
3. **Credentials** (access tokens, refresh tokens, API keys) to be securely stored and injected
4. **The deployed app** to have a settings/integrations page where account linking happens

The concrete scenario: A coach deploys their coaching app via Brick. That app needs a "Connect Calendly" button in its settings page. When the coach clicks it, they go through Calendly's OAuth flow, and the resulting tokens get stored so the app's booking service can call Calendly's API on their behalf.

---

## What Already Exists

The codebase has strong foundations to build on:

### Port-Based Integration Registry
**File**: `src/integrations/registry.ts` + `src/types/graph.ts`

Every integration is an `IntegrationDefinition` with typed `Port` objects defining inputs/outputs as `PortSchema` (JSON Schema subset). The registry provides `createIntegrationNode()` to stamp out graph nodes for any registered integration.

```typescript
// Already exists in src/types/graph.ts
interface IntegrationDefinition {
  type: IntegrationType;
  name: string;
  description: string;
  category: 'scheduling' | 'payments' | 'crm' | 'email' | 'sms' | 'video' | 'forms';
  ports: { inputs: Port[]; outputs: Port[] };
  requiredConfig: string[];      // e.g., ['apiKeyEnvVar']
  docsUrl?: string;
  icon?: string;
}
```

### Calendly & Cal.com Implementations
**Files**: `src/integrations/scheduling/calendly.ts`, `src/integrations/scheduling/cal-com.ts`

Full port contracts with typed webhook schemas. Both use `requiredConfig: ['apiKeyEnvVar']` — meaning they expect an env var name that holds the API key. The current model is: someone manually sets `CALENDLY_API_KEY=xxx` in the environment.

### BAC Integration Tracking
**File**: `src/types/bac.ts`

The BAC has an `integrations: BACIntegration[]` array that records which external services an architecture uses, plus `systemContracts.nodes` with input/output contracts per node.

### Contract-Driven Codegen
**Files**: `src/codegen/planner.ts`, `src/codegen/generator.ts`, `src/codegen/prompts.ts`

The codegen pipeline reads BAC node contracts and generates code files with TypeScript interfaces matching the port schemas. The LLM receives full BAC context including integration node contracts.

### What's Missing
- No OAuth flow code generation
- No credential vault or storage
- No UI generation for settings/integrations pages
- No deployer-level credential injection
- No distinction between app-level credentials (client_id/secret) and user-level credentials (access/refresh tokens)
- No token refresh lifecycle

---

## The Two-Tier Credential Model

This is the core insight that shapes the entire architecture. There are **two distinct levels** of credentials for any OAuth integration:

### Tier 1: App-Level Credentials (provided by the Brick user — the app builder)
- **What**: `client_id` and `client_secret` for the OAuth application
- **Who provides them**: The person building the app on Brick (e.g., the coach who registers a Calendly OAuth app)
- **When**: During project configuration in Brick Studio, before or after deploy
- **Where stored**: Brick platform's credential vault, injected into the deployed app as environment variables
- **Lifecycle**: Set once, rarely changes, same for all end-users of the deployed app

### Tier 2: User-Level Credentials (acquired per end-user of the deployed app)
- **What**: `access_token` and `refresh_token` obtained via OAuth authorization code flow
- **Who provides them**: Each end-user of the deployed app (e.g., a coach's client linking their own Calendly)
- **When**: At runtime, when the end-user clicks "Connect Calendly" in the deployed app
- **Where stored**: The deployed app's own database, encrypted at rest
- **Lifecycle**: Acquired via OAuth, refreshed automatically, revocable by end-user

```
┌─────────────────────────────────────────────────┐
│  Brick Studio (design time)                      │
│                                                   │
│  App builder configures:                          │
│  ┌──────────────────────────────────┐            │
│  │ Calendly Integration             │            │
│  │ ─────────────────────────        │            │
│  │ Client ID:  [____________]       │  ← Tier 1  │
│  │ Client Secret: [____________]    │            │
│  │ Scopes: ☑ read ☑ write          │            │
│  └──────────────────────────────────┘            │
└────────────────────┬────────────────────────────┘
                     │ deploy
                     ▼
┌─────────────────────────────────────────────────┐
│  Deployed Coach App (runtime)                    │
│                                                   │
│  End-user sees:                                   │
│  ┌──────────────────────────────────┐            │
│  │ Settings → Integrations          │            │
│  │ ─────────────────────────        │            │
│  │ Calendly    [Connect ▶]         │  ← Tier 2  │
│  │ Stripe      [Connect ▶]         │  (OAuth)   │
│  │ Google Cal  [Connected ✓]       │            │
│  └──────────────────────────────────┘            │
└─────────────────────────────────────────────────┘
```

---

## Proposed Architecture

### 1. Extend IntegrationDefinition with Auth Metadata

The current `IntegrationDefinition` knows about ports and required config, but nothing about auth. Add an `auth` descriptor:

```typescript
// Extend existing IntegrationDefinition in src/types/graph.ts

interface OAuthDescriptor {
  type: 'oauth2';
  authorizationUrl: string;        // e.g., 'https://auth.calendly.com/oauth/authorize'
  tokenUrl: string;                // e.g., 'https://auth.calendly.com/oauth/token'
  scopes: string[];                // e.g., ['default']
  pkce?: boolean;                  // Use PKCE extension (recommended for public clients)
  tokenRefreshSupported: boolean;  // Whether refresh_token flow is available
}

interface ApiKeyDescriptor {
  type: 'api_key';
  headerName?: string;             // e.g., 'Authorization' (default) or 'X-Api-Key'
  headerPrefix?: string;           // e.g., 'Bearer' (default)
  envVarName: string;              // e.g., 'CALENDLY_API_KEY'
}

interface WebhookDescriptor {
  type: 'webhook';
  signatureHeader?: string;        // e.g., 'X-Calendly-Webhook-Signature'
  signatureAlgorithm?: string;     // e.g., 'hmac-sha256'
}

type AuthDescriptor = OAuthDescriptor | ApiKeyDescriptor | WebhookDescriptor;

// Updated IntegrationDefinition
interface IntegrationDefinition {
  type: IntegrationType;
  name: string;
  description: string;
  category: 'scheduling' | 'payments' | 'crm' | 'email' | 'sms' | 'video' | 'forms';
  ports: { inputs: Port[]; outputs: Port[] };
  requiredConfig: string[];
  auth: AuthDescriptor[];          // NEW — can support multiple auth methods
  appLevelCredentials: Array<{     // NEW — what the app builder must provide
    key: string;                   // 'client_id', 'client_secret', 'webhook_secret'
    label: string;                 // 'Calendly Client ID'
    secret: boolean;               // true = encrypted, masked in UI
    required: boolean;
  }>;
  docsUrl?: string;
  icon?: string;
  brandColor?: string;             // For UI rendering, e.g., '#006BFF' for Calendly
}
```

### 2. BAC Integration Node Enhancement

When an integration node exists in the BAC, it should carry auth requirements so the codegen pipeline knows what to generate:

```typescript
// Extend BACIntegration in src/types/bac.ts
interface BACIntegration {
  id: string;
  name: string;
  category: 'internal' | 'external';
  purpose: string;
  integrationType?: IntegrationType;   // NEW — links to registry
  authType?: 'oauth2' | 'api_key';    // NEW — which auth flow to generate
  scopes?: string[];                   // NEW — OAuth scopes needed
  appCredentialKeys?: string[];        // NEW — ['client_id', 'client_secret']
}
```

### 3. Credential Vault (Platform-Level)

App-level credentials (Tier 1) are stored in Brick's platform database, encrypted, and injected into deployed apps as environment variables.

```typescript
// New: src/server/services/credential-vault.ts

interface StoredCredential {
  id: string;
  projectId: string;
  integrationId: string;           // e.g., 'calendly'
  key: string;                     // e.g., 'client_id', 'client_secret'
  encryptedValue: string;          // AES-256-GCM encrypted
  createdAt: string;
  updatedAt: string;
}

interface CredentialVault {
  // Store an app-level credential for a project's integration
  set(projectId: string, integrationId: string, key: string, value: string): Promise<void>;

  // Retrieve (decrypted) for deployment injection
  get(projectId: string, integrationId: string, key: string): Promise<string | null>;

  // List all credentials for a project (values masked)
  list(projectId: string): Promise<Array<{ integrationId: string; key: string; hasValue: boolean }>>;

  // Delete a credential
  delete(projectId: string, integrationId: string, key: string): Promise<void>;
}
```

**Storage**: PostgreSQL table `integration_credentials` with:
- `id`, `project_id`, `integration_id`, `key`, `encrypted_value`, `iv`, `auth_tag`
- Encryption key from `BRICK_CREDENTIAL_KEY` env var (AES-256-GCM)
- Row-level isolation by project_id

### 4. Generated OAuth Flow in Deployed Apps

When the codegen pipeline encounters an integration node with `authType: 'oauth2'`, it should generate these files into the app artifact:

```
generated-app/
├── src/
│   ├── integrations/
│   │   ├── oauth-handler.ts       # Generic OAuth callback handler
│   │   ├── token-store.ts         # DB table + CRUD for user tokens
│   │   ├── token-refresh.ts       # Background job to refresh expiring tokens
│   │   └── calendly/
│   │       ├── client.ts          # Typed API client using stored tokens
│   │       └── config.ts          # Reads CLIENT_ID/SECRET from env
│   └── routes/
│       └── integrations.ts        # /auth/calendly/connect, /auth/calendly/callback
├── src/pages/ (or views/)
│   └── settings/
│       └── integrations.tsx       # Settings page with Connect/Disconnect buttons
```

The generated OAuth flow:

```
End-user clicks "Connect Calendly"
    ↓
GET /auth/calendly/connect
    → Generates state param (CSRF protection)
    → Stores state in session
    → Redirects to: https://auth.calendly.com/oauth/authorize
        ?client_id={from env}
        &redirect_uri={app callback URL}
        &response_type=code
        &scope={from integration def}
        &state={csrf state}
    ↓
User authorizes on Calendly's site
    ↓
Calendly redirects to: /auth/calendly/callback?code=xxx&state=yyy
    ↓
GET /auth/calendly/callback
    → Validates state param
    → Exchanges code for tokens: POST https://auth.calendly.com/oauth/token
        { grant_type: 'authorization_code', code, client_id, client_secret, redirect_uri }
    → Stores access_token + refresh_token in token-store (encrypted)
    → Redirects to settings page with success message
    ↓
Any service needing Calendly access:
    → Reads user's token from token-store
    → If expired, refreshes via token-refresh
    → Makes API call with Bearer token
```

### 5. Codegen Pipeline Changes

The codegen planner needs to recognize integration nodes and plan additional files:

```typescript
// In src/codegen/planner.ts — extend planCodeStructureFromBAC()

function planIntegrationFiles(bac: BrickAppContract): PlannedFile[] {
  const oauthIntegrations = bac.integrations.filter(i => i.authType === 'oauth2');
  const files: PlannedFile[] = [];

  if (oauthIntegrations.length > 0) {
    // Generic OAuth infrastructure
    files.push(
      { path: 'src/integrations/oauth-handler.ts', purpose: 'Generic OAuth2 authorization code flow handler' },
      { path: 'src/integrations/token-store.ts', purpose: 'Encrypted token storage with CRUD operations' },
      { path: 'src/integrations/token-refresh.ts', purpose: 'Background token refresh before expiry' },
    );

    // Per-integration files
    for (const integration of oauthIntegrations) {
      const slug = integration.integrationType; // e.g., 'calendly'
      files.push(
        { path: `src/integrations/${slug}/client.ts`, purpose: `Typed ${integration.name} API client` },
        { path: `src/integrations/${slug}/config.ts`, purpose: `${integration.name} OAuth configuration` },
      );
    }

    // Settings UI
    files.push(
      { path: 'src/pages/settings/integrations.tsx', purpose: 'Settings page with Connect/Disconnect buttons for each integration' },
    );

    // Integration routes
    files.push(
      { path: 'src/routes/integrations.ts', purpose: 'OAuth connect/callback routes for all integrations' },
    );
  }

  return files;
}
```

The codegen generator already passes full BAC context to the LLM. The integration definition's `auth` descriptor and `appLevelCredentials` will be serialized into the prompt so the LLM generates correct OAuth URLs, scopes, and env var references.

### 6. Deployer Credential Injection

When deploying, the deployer reads Tier 1 credentials from the vault and injects them as environment variables in the deployed service:

```typescript
// In src/server/services/digitalocean.ts — extend deploy flow

async function injectIntegrationCredentials(
  projectId: string,
  appSpec: DOAppSpec,
  vault: CredentialVault,
  bac: BrickAppContract
): Promise<DOAppSpec> {
  const oauthIntegrations = bac.integrations.filter(i => i.authType === 'oauth2');

  for (const integration of oauthIntegrations) {
    const slug = integration.integrationType?.toUpperCase(); // e.g., 'CALENDLY'

    // Read app-level credentials from vault
    const clientId = await vault.get(projectId, integration.id, 'client_id');
    const clientSecret = await vault.get(projectId, integration.id, 'client_secret');

    if (clientId && clientSecret) {
      // Inject into the service's env vars
      appSpec.services[0].envs.push(
        { key: `${slug}_CLIENT_ID`, value: clientId, type: 'SECRET' },
        { key: `${slug}_CLIENT_SECRET`, value: clientSecret, type: 'SECRET' },
      );
    }
  }

  return appSpec;
}
```

### 7. UI in Brick Studio (App Builder's View)

The Brick Studio workspace needs an "Integration Settings" section in the component detail panel when an integration node is selected. This is where the app builder provides their Tier 1 credentials:

```
┌─────────────────────────────────────┐
│ Component: Calendly                  │
│ Type: scheduling / integration       │
│                                      │
│ ─── Integration Settings ──────     │
│                                      │
│ Client ID                            │
│ ┌─────────────────────────────────┐ │
│ │ a1b2c3d4-xxxx-yyyy-zzzz        │ │
│ └─────────────────────────────────┘ │
│                                      │
│ Client Secret                        │
│ ┌─────────────────────────────────┐ │
│ │ ●●●●●●●●●●●●●●●●●●●●●●●●●●●●  │ │
│ └─────────────────────────────────┘ │
│                                      │
│ Redirect URI (auto-generated)        │
│ https://your-app.ondigitalocean.app  │
│         /auth/calendly/callback      │
│ [Copy]                               │
│                                      │
│ Scopes: ☑ default                    │
│                                      │
│ Status: ✓ Credentials configured     │
│                                      │
│ ─── Port Contracts ────────────     │
│ Inputs:  booking_request, ...        │
│ Outputs: booking_confirmed, ...      │
└─────────────────────────────────────┘
```

---

## The Plugin Pattern: Adding a New Integration

The goal is that adding a new integration (e.g., Stripe) requires:

1. **Write a definition file** — `src/integrations/payments/stripe.ts`
2. **Register it** — `registerIntegration(stripeDefinition)` in the registry
3. **Done** — The rest is automatic:
   - The BAC captures it when the user adds a Stripe node
   - The codegen pipeline generates OAuth routes, token storage, API client, settings UI
   - The deployer injects credentials
   - The deployed app has a working "Connect Stripe" button

A definition file for Stripe would look like:

```typescript
// src/integrations/payments/stripe.ts

import { registerIntegration } from '../registry';

registerIntegration({
  type: 'stripe',
  name: 'Stripe',
  description: 'Payment processing, subscriptions, and invoicing',
  category: 'payments',
  brandColor: '#635BFF',

  auth: [
    {
      type: 'oauth2',
      authorizationUrl: 'https://connect.stripe.com/oauth/authorize',
      tokenUrl: 'https://connect.stripe.com/oauth/token',
      scopes: ['read_write'],
      pkce: false,
      tokenRefreshSupported: true,
    },
  ],

  appLevelCredentials: [
    { key: 'client_id', label: 'Stripe Client ID', secret: false, required: true },
    { key: 'api_key', label: 'Stripe Secret Key', secret: true, required: true },
    { key: 'webhook_secret', label: 'Webhook Signing Secret', secret: true, required: false },
  ],

  ports: {
    inputs: [
      {
        id: 'create_checkout',
        name: 'Create Checkout Session',
        direction: 'input',
        required: false,
        description: 'Create a Stripe Checkout session for one-time or subscription payments',
        contract: {
          type: 'object',
          properties: {
            lineItems: { type: 'array', description: 'Products/prices to charge' },
            customerId: { type: 'string', description: 'Stripe customer ID' },
            successUrl: { type: 'string', description: 'Redirect URL after success' },
            cancelUrl: { type: 'string', description: 'Redirect URL after cancel' },
            mode: { type: 'string', description: "'payment' | 'subscription'" },
          },
          required: ['lineItems', 'successUrl', 'cancelUrl', 'mode'],
        },
      },
      // ... more input ports
    ],
    outputs: [
      {
        id: 'payment_succeeded',
        name: 'Payment Succeeded',
        direction: 'output',
        required: false,
        description: 'Webhook event when a payment succeeds',
        contract: {
          type: 'object',
          properties: {
            paymentIntentId: { type: 'string' },
            amount: { type: 'number', description: 'Amount in cents' },
            currency: { type: 'string' },
            customerId: { type: 'string' },
            metadata: { type: 'object' },
          },
        },
      },
      // ... more output ports
    ],
  },

  requiredConfig: ['api_key'],
  docsUrl: 'https://stripe.com/docs/api',
});
```

That's the entire plugin. The pipeline handles everything else.

---

## Implementation Phases

### Phase 1: Auth Descriptors & Credential Vault
- Extend `IntegrationDefinition` with `auth` and `appLevelCredentials` fields
- Update Calendly and Cal.com definitions to include auth descriptors
- Create `integration_credentials` PostgreSQL table
- Implement `CredentialVault` service with AES-256-GCM encryption
- Add API routes: `POST/GET/DELETE /api/projects/:id/credentials`
- Add credential input fields to the ComponentDetailPanel when an integration node is selected

**Files**:
- `src/types/graph.ts` (extend IntegrationDefinition)
- `src/integrations/scheduling/calendly.ts` (add auth descriptor)
- `src/integrations/scheduling/cal-com.ts` (add auth descriptor)
- NEW: `src/server/services/credential-vault.ts`
- NEW: `src/server/db/migrations/xxx-integration-credentials.ts`
- `src/server/routes/` (new credential routes)
- `frontend/src/components/workspace/ComponentDetailPanel.tsx` (credential fields)

### Phase 2: Codegen Pipeline Integration
- Extend planner to recognize OAuth integration nodes and plan additional files
- Extend generator prompts with auth descriptor context
- Add prompt templates for OAuth handler, token store, token refresh, settings UI
- Test with Calendly: generate a coach app with working OAuth flow in the artifact

**Files**:
- `src/codegen/planner.ts` (integration file planning)
- `src/codegen/generator.ts` (auth context in prompts)
- `src/codegen/prompts.ts` (new prompt templates for OAuth files)

### Phase 3: Deployer Credential Injection
- Extend DigitalOcean deployer to read from credential vault
- Inject Tier 1 credentials as SECRET env vars in the AppSpec
- Auto-generate redirect URI based on deployed app URL
- Add credential completeness check before deploy (warn if missing)

**Files**:
- `src/server/services/digitalocean.ts` (credential injection)
- Deploy flow validation

### Phase 4: Token Refresh & Lifecycle
- Generated apps include a background job (or middleware) for token refresh
- Token expiry tracking in the generated token store
- Automatic refresh before expiry (e.g., refresh when <10% of TTL remaining)
- Error handling: revoked tokens, failed refreshes → notify user to re-authorize

**Files**: Primarily codegen prompt templates — the generated code handles this, not the platform.

### Phase 5: Additional Integrations
- Write Stripe definition (payments)
- Write SendGrid definition (email)
- Write Google Calendar definition (scheduling)
- Each is just a definition file + `registerIntegration()` call

---

## Key Design Decisions

### Why not store all credentials in the platform?
Tier 2 (user-level) tokens belong in the **deployed app's own database**, not Brick's platform DB. Reasons:
- The deployed app runs independently — it can't call back to Brick's API at runtime
- Tenant isolation: each deployed app is its own security boundary
- The platform shouldn't hold every end-user's OAuth tokens for every deployed app

### Why generate OAuth code instead of providing a runtime library?
Generated apps should be **self-contained artifacts**. If the code is generated, the app builder can inspect it, customize it, or swap out the OAuth library. A runtime dependency on Brick creates coupling that defeats the purpose of "deploy and forget."

### Why JSON Schema for port contracts?
JSON Schema is the lingua franca for describing data shapes. It's what the LLM understands best for generating TypeScript interfaces, and it maps directly to validation libraries (Zod, Ajv) in the generated code.

### Why AES-256-GCM for credential encryption?
Industry standard for authenticated encryption. The auth tag prevents tampering. Node.js `crypto` module supports it natively — no external dependencies needed.

---

## Edge Cases & Considerations

- **Redirect URI chicken-and-egg**: The OAuth app needs a redirect URI, but the deployed app's URL isn't known until deploy. Solution: Generate a placeholder redirect URI during design, update it post-deploy, and surface it in the Brick Studio UI so the app builder can register it with the OAuth provider.

- **Multiple users, same integration**: In a multi-tenant deployed app, each user has their own OAuth tokens. The generated token store should be keyed by `(user_id, integration_id)`.

- **Webhook verification**: Integrations like Stripe sign webhook payloads. The webhook secret (Tier 1) must be available to the deployed app. The generated webhook handler should verify signatures using the auth descriptor's `signatureHeader` and `signatureAlgorithm`.

- **Integration node removal**: If a user removes an integration node from the architecture, the next codegen run should not generate OAuth files for it. But existing credentials in the vault should be preserved (soft delete) in case they re-add it.

- **Non-OAuth integrations**: Some services use API keys only (no OAuth). The auth descriptor handles this via `ApiKeyDescriptor`. The generated code reads the key from an env var — no OAuth flow, no token store, just a simple authenticated HTTP client.
