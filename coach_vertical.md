# Coaching Vertical — Comprehensive Application Specification

> Synthesized from 6 product ideation sessions (Jan 28 – Feb 11, 2026), the Brick for Coaches Architecture Overview, and ongoing development sessions between Steven and Darian.

---

## 1. Vision and Market Context

### The Problem
Coaches (fitness, life, business, wellness, consulting) face **severe tool fragmentation**. A typical coach uses 5+ separate applications for scheduling, payments, CRM, video calls, and content delivery. No true "Shopify for coaches" exists. Existing competitors either capture too much value themselves (Kajabi), solve too many problems poorly (GoHighLevel), or lack AI-native capabilities (Paperbell). Most platforms stop at static website generation and don't handle the integrations required for actual business operations.

### The Opportunity
The coaching/professional services vertical is the second-largest web application vertical behind e-commerce. COVID normalized online personal training and remote coaching, expanding the addressable market dramatically. Coaches need more than a website — they need lead capture, scheduling, payments, CRM, and client management all in one place. The coaching space remains "unplatformed."

### The Vision
Build an **AI-native coaching platform** where coaches can describe what they want in natural language and get a fully functional, deployed coaching business application — not just a static site. The coach should never need to see or write code. Every interaction is conversational. The platform itself is built on top of Brick Studio (an AI-native app factory), with coaching as the first vertical to prove the platform's capability.

### Competitive Landscape
- **Kajabi**: $100M+ ARR, focused on courses/coaching at scale, but captures too much value and targets mega-scale experts
- **GoHighLevel**: Tries to solve too many problems; not coaching-specific
- **Paperbell**: Closest to coaching-specific, but not AI-native, limited personalization, clunky onboarding
- **Lovable/Bolt/Replit/Base44**: General app builders — stop at static sites, no coaching-specific integrations, no persistent business management
- **B12/Durable.ai**: Website builders that say they're for coaches but are indistinguishable from general-purpose tools at first glance

**Differentiator**: "Build something functional" — not just a lovable website, but an operational coaching business with scheduling, CRM, email, and payments wired in from day one. AI-native throughout: the coach interacts conversationally to build, customize, and run their business.

---

## 2. Target User Persona

### Primary: Independent Coaches and Personal Trainers
- Fitness coaches, life coaches, business coaches, wellness practitioners, consultants
- Non-technical or semi-technical — should never need to touch code
- Currently juggling 5+ separate tools (Calendly, Stripe, spreadsheets, email marketing, a basic website)
- Want to capture leads via their website, qualify them through assessments/intake forms, book strategy calls, onboard clients, manage ongoing sessions, and get paid
- Mobile-first when on the go (at the gym, between sessions) but use laptop at home for deeper work
- Value simplicity: "Describe, click, done" — 3 steps maximum for any action
- Some coaches want to learn and grow; others just want it handled

### Secondary: Coaching Businesses with Small Teams
- May have multiple coaches under one brand
- Need multi-tenant client management
- Want analytics on business performance, client retention, and referrals

### Real-World User Flow (from Steven's coaching practice — TechnicallyFit.com)
1. Prospect visits coaching website
2. Prospect fills out an assessment/intake form
3. Assessment qualifies them and presents a Calendly link
4. Prospect books a strategy call
5. Coach reviews prospect info before the call
6. Coach and prospect have a strategy call
7. If aligned, coach onboards the client
8. Ongoing: session scheduling, payment collection, progress tracking, communication

---

## 3. Core Features and Functional Requirements

### 3.1 Landing Page / Website Builder
- Coaches get a professional, customizable landing page for their coaching business
- **Template system**: 10-12 predefined templates extracted from high-quality designs (Aura.build-style), pure HTML with embedded styling for token efficiency
- Users can start from a template or from scratch
- **Conversational customization**: Coaches describe changes in natural language ("make the hero section more motivational," "add my testimonials") and an AI agent modifies the site
- Coaches can paste a design inspiration URL, which is scraped and used as visual context
- No code exposed to coaches — all modifications happen through conversational AI
- **Template switching**: Dashboard controls allow coaches to toggle between templates
- Developer view (toggle) available for technical coaches who want to see/edit code
- Non-technical view shows plain English descriptions of what each section does

### 3.2 Lead Capture and Intake
- Customizable intake/assessment forms embedded in the landing page
- Form submissions flow into the CRM as new contacts
- Conditional logic: assessments can qualify/disqualify leads
- After form completion, automatically present scheduling link (Calendly integration)
- Track the entire funnel: visit → form fill → booking → call → client conversion

### 3.3 Scheduling Integration
- **Primary integration: Calendly** (and/or Cal.com)
- Coaches link their Calendly account natively within their coaching application (not at the Brick platform level)
- Booking a session creates a Contact Interaction event (event-sourced)
- Cancellations and rescheduling also tracked as interaction events
- Webhooks from Calendly create real-time updates in the coaching app
- Future: built-in scheduling without third-party dependency

### 3.4 Payment Processing
- **Primary integration: Stripe**
- Coaches link their Stripe account within their coaching application
- Support for: one-time payments, session packages, subscriptions/recurring billing, invoicing
- Every payment creates a Contact Interaction event for analytics
- Stripe webhooks trigger real-time transaction logging
- Future: full invoicing system

### 3.5 CRM (Client Relationship Management)
Built from scratch as a lightweight, purpose-built CRM with three core tables:

#### Contacts Table
```
{
  id, tenantId, firstName, lastName, email, phone,
  timezone, status, metadata, createdAt, updatedAt
}
```
- Core entity across all verticals (clients for coaches, customers for e-commerce)
- Tenant-scoped (row-level isolation via tenant_id)
- Flexible metadata field for vertical-specific extensions

#### Notes Table
```
{
  id, tenantId, contactId, title, content,
  tags, metadata, createdAt, updatedAt
}
```
- Per-contact notes with flexible metadata and tags
- Coaches can record session observations, client goals, progress updates
- Searchable and filterable by tags

#### Contact Interactions Table (Event-Sourced)
```
{
  id, tenantId, contactId, type, channel,
  title, description, occurredAt, metadata, createdAt
}
```
- Every touchpoint is a timestamped transaction: bookings, cancellations, payments, messages, sessions, referrals
- Enables flexible analytics views and historical playback
- Integration with product analytics tools
- Types include: purchase, booking, call, session, cancellation, message, referral, note

#### CRM UI Features
- Client list view with search and filter
- Client detail view (click to expand) showing full profile, all notes, interaction history
- Ellipsis menu on each client for quick actions
- Contact detail pop-up with comprehensive client information
- Track "top advocates" — clients who refer others
- Flag clients who have gone out of touch for re-engagement

#### Why Not 20CRM (Open Source)
- Evaluated and rejected: requires its own PostgreSQL + ClickHouse stack (operational bloat)
- AGPL v3 licensing would require open-sourcing modifications
- Multi-tenancy would require adding tenant discriminators to all data models
- Building three simple tables from scratch is simpler than forcing a single-tenancy tool into multi-tenant context

### 3.6 Email Communication
- **Primary integration: Resend** (chosen over SendGrid/Twilio for programmatic management)
- Email costs are extremely low (~$0.001 per email)
- Two-tier approach:
  - **Coaches with custom domains**: Programmatically set up domain-specific Resend account when they configure their custom domain
  - **Coaches without custom domains**: Proxy through shared platform account
- IP reputation management: separate good/bad reputation IP pools to prevent spam from one coach affecting others
- Use cases: client onboarding emails, session reminders, follow-ups, marketing/newsletters

### 3.7 Analytics Dashboard
- Key stickiness feature alongside CRM
- Views powered by the event-sourced Contact Interactions table
- Analytics include:
  - Revenue over time (from Stripe transaction events)
  - Client acquisition and retention rates
  - Top advocates / referral tracking
  - Session booking patterns
  - Client engagement scores (frequency of interactions)
  - Clients at risk of churn (no recent interactions)
- Transaction-based approach enables integration with open-source product analytics tools for advanced views

### 3.8 AI-Native Features (Within the Coaching App)

The coaching application itself must be AI-native — not AI "bolted on." Three distinct AI workloads:

#### Coach Co-Pilot (Chat Agent)
- Conversational interface for coaches to manage and modify their application
- "Change my landing page headline to X" → agent edits the app safely
- "Show me clients who haven't booked in 30 days" → agent queries and presents data
- Natural language business management

#### Client Ops Agent (Agentic Workflow)
- Automated booking confirmations and session follow-ups
- Client re-engagement triggers (e.g., auto-follow-up when a client hasn't booked in X days)
- Smart scheduling suggestions based on coach availability patterns

#### Session Intelligence (Backend AI Service)
- Summarize client interaction history before a session
- Suggest next actions based on client progress
- Generate coaching program frameworks based on client goals (leveraging a "hardware engine" specification for program generation — coaches can generate a program in 13 seconds and then make modifications)

#### AI Behavior Spec (from BAC Contract)
Each AI workflow includes:
- **Type**: chat-agent, agent-workflow, or backend-AI-service
- **Context**: what data sources and tools the AI has access to
- **Actions**: what the AI can do
- **Success metrics**: how to measure effectiveness
- **Fallback behavior**: what happens when AI can't handle a request
- **Audit trail**: what changed and why
- **Guardrails**: safety boundaries

### 3.9 Notification System
- In-app notifications for new bookings, payments, cancellations
- Each coach gets their own dedicated notification system
- Future: push notifications for mobile app

---

## 4. Technical Architecture

### 4.1 Platform-First Model
```
APPLICATION LAYER
├── Coach Vertical (First App)
│   ├── Dashboard UI
│   ├── Coaching API
│   └── App Integrations (Calendly, Stripe, Email)
└── Future Verticals (E-Commerce, SaaS, Education, ...)

PLATFORM FOUNDATION (Brick Studio)
├── Core Pipeline
│   ├── Mermaid Parser
│   ├── AST Transformer
│   ├── AppSpec Generator (YAML)
│   └── Validator
├── LLM Layer
│   ├── Architect Agent
│   └── LLM Client (OpenRouter.ai for model routing)
├── Data Layer
│   ├── PostgreSQL via Supabase (production)
│   ├── SQLite (development)
│   ├── Contacts, Notes, Contact Interactions (foundational)
│   └── Row-level tenant isolation via tenant_id
├── Deployment Layer
│   ├── DigitalOcean (primary cloud)
│   ├── Docker Compose (containerization)
│   └── doctl CLI (deployment automation)
└── Agent Substrate
    ├── Model Router (OpenRouter.ai)
    ├── Tool Execution
    ├── Memory and Context Management
    ├── Prompt/Skill Registry
    └── Safety Evals and Telemetry
```

### 4.2 Data Flow Pipeline
```
Natural Language → LLM → Mermaid Diagram → Parser → AST → Transformer → IR Components → AppSpec YAML → Validator + doctl → DigitalOcean
```

### 4.3 Brick App Contract (BAC) — Intermediary Language
Every application generated by Brick (including coaching) is defined by a canonical BAC containing:
- **User outcomes and workflows**: what the end-user (coach) needs to accomplish
- **AI behavior spec**: what decisions AI makes, with what context and tools
- **Domain/data model**: entities, relationships, and data structures
- **Integration and external systems**: third-party services and their connection patterns
- **Runtime/deployment requirements**: infrastructure needs
- **Guardrails, evals, and observability expectations**: safety and monitoring

The BAC is the single source of truth. All planning, code generation, infrastructure deployment, and iteration compile from this contract.

### 4.4 Database Strategy
- **Production**: Supabase (PostgreSQL) — chosen for SQL access, mature tooling, analytics capability, extensibility (PostGIS, PGVector), and the ability to fall back to raw SQL
- **Development**: SQLite (transitioning to local PostgreSQL)
- **Potential addition**: Convex as a lightweight layer for real-time messaging features only
- **Authentication**: JWT-based auth system
- **Multi-tenancy**: Row-level isolation via `tenant_id` on all data tables

### 4.5 Integration Architecture
- Integrations are **application-level**, not platform-level
- Each vertical manages its own integration lifecycle
- Integration linking happens natively within the generated application (not in Brick Studio)
- Common integration patterns cached at the Brick level and baked into the agent spec YAML
- When Brick generates an app, the agent building it already has context about relevant integrations
- Integration Port System:
  - **Calendly Ports**: booking_request, availability_check → booking_confirmed, booking_cancelled, booking_rescheduled, available_slots
  - **Stripe Ports** (planned): create_charge, create_subscription, create_invoice → payment_succeeded, payment_failed, subscription_created

### 4.6 Deployment Strategy
- **Ephemeral demos**: Horizontally scaling Docker containers with temporary endpoints for previewing
- **Production**: DigitalOcean App Platform with declarative YAML (AppSpec)
- **Pricing**: Transparent cost pass-through to customers — "managed at cost," not markup
- **Generated code is persistent**: Created once and stashed, not regenerated on every deploy
- Users iterate on stashed code through agent-assisted workflows or manual edits
- Each coach gets their own dedicated database and notification system

### 4.7 Cost Optimization
- Multi-tier LLM approach:
  - Cheap LLMs (e.g., Haiku) for simple data extraction and text synthesis
  - Expensive models (Claude Code) only for complex code generation
- Predefined templates reduce generation costs
- LangGraph or LangChain for agent orchestration with different agents at different pipeline stages
- OpenRouter.ai for model routing — single API key, automatic fallback, competitive pricing

### 4.8 Mobile Application
- **Expo** (React Native) for cross-platform deployment (iOS, Android, Web from one codebase)
- Lightweight companion app for coaches on the go
- Core use cases: respond to client messages, check upcoming sessions, view quick client info
- One-click deployment to App Store and Play Store from GitHub repo

---

## 5. Onboarding Flow

### Three-Step Minimal Onboarding
1. **Step 1**: Basic information — what kind of coaching do you do? Business name?
2. **Step 2**: Choose a template or start from scratch (voice as primary interaction method)
3. **Step 3 — "Power Up"**: Enable integrations by category:
   - Calendar (not "Calendly" — generic category)
   - Payment (not "Stripe" — generic category)
   - Emails (not "SendGrid" — generic category)

### Onboarding UX Requirements
- Smooth transitions between steps
- Right-side preview that updates in real-time when users select integrations
- Auto-scroll to relevant section when an integration is toggled
- All toggle elements must be fully clickable
- Loading state after submission ("Laying the foundation, generating your site")
- AI chat placeholder during onboarding for future conversational build flow
- Minimal steps to reduce drop-off — "the quicker people can get in and see their live site is probably for the best"
- Integration setup must also be available in the dashboard for users who skip during onboarding

### Post-Onboarding
- Dashboard immediately shows:
  - Live site preview
  - Client management (CRM)
  - Schedule view
  - Payments view
  - Site editor (conversational AI interface for making website changes)
  - Integration management
  - Analytics (future)

---

## 6. Coach Dashboard Structure

The coach's dashboard (post-onboarding) includes:

| Section | Description | Status |
|---------|-------------|--------|
| **Website Preview** | Live preview of the coach's public-facing site | Implemented |
| **Site Editor** | Conversational AI interface for modifying the website | Placeholder |
| **Clients** | CRM view — list of contacts with detail expansion | 85% |
| **Schedule** | Calendar view connected to Calendly integration | Partial |
| **Payments** | Payment history and Stripe management | Not started |
| **Integrations** | Link/manage Calendar, Payment, Email providers | 25% |
| **Analytics** | Business intelligence dashboard | Not started |
| **AI Assistant** | Chat interface for managing the coaching business | Placeholder |
| **Notifications** | Real-time alerts for bookings, payments, etc. | Not started |

---

## 7. Vertical Presets and Extensibility

The coaching platform supports multiple coaching sub-verticals through preset configurations:
- Coaching (general)
- Fitness
- Consulting
- Healthcare
- Therapy
- Education
- Creative
- General

Each preset can customize:
- Default template selection
- Relevant integrations
- CRM field configurations
- AI behavior and prompts
- Analytics focus areas

---

## 8. Pricing Philosophy

- **Infrastructure**: Transparent cost pass-through (DigitalOcean costs passed directly to coach, not marked up)
- **Platform value**: Subscription-based pricing for the coaching platform features
- **Tiered approach** (proposed):
  - Free tier: Basic website + limited features
  - Pro: Full integrations + CRM + analytics + AI assistant
  - Enterprise: Multi-coach teams + advanced analytics + audit logs
- **Not trying to be Kajabi**: Don't capture the coach's value; be an enabler. "This is all you. We're just a tool to help enable you."

---

## 9. Implementation Status (as of Feb 2026)

| Area | Status | % Complete |
|------|--------|-----------|
| Core Pipeline (Parser, Transformer, Generator, Validator) | Working | 95% |
| Database & Auth (SQLite, Users, Projects, JWT) | Working | 100% |
| Foundational Data (Contacts, Notes, Interactions) | Working | 100% |
| Deployment (DigitalOcean, Cost Estimator) | Working | 100% |
| UI/Dashboard (Wizard, Clients, Schedule, Payments views) | Partial | 85% |
| Integrations (Calendly done; Stripe, Email not started) | Partial | 25% |
| Coaching Backend (API, Services, DB Tables) | Minimal | 10% |
| BAC Contract System | In progress | ~30% |
| AI-Native Agent Substrate | In progress | ~20% |
| Mobile App (Expo) | Not started | 0% |

### Next Implementation Priorities (MVP Roadmap)
**Phase 1 — Coaching MVP:**
- `/api/contacts` — CRUD via foundational data layer
- `/api/sessions` — Booking and session management
- `/api/notes` — Per-contact notes
- `/api/interactions` — Contact interaction event log
- Service Layer: ContactService, SessionService, PaymentService

**Phase 2 — Payments:**
- Stripe integration
- Calendly webhooks (deeper integration)
- Invoicing

**Phase 3 — Scale:**
- Email/Notifications
- Analytics dashboard
- Multi-vertical support
- Platform dashboard (visual inspection of running apps)

---

## 10. Key Design Principles

1. **AI-Native, Not AI-Bolted-On**: Every coaching app feature should have an AI component by default — not as an afterthought
2. **Conversational First**: Coaches interact through natural language, not forms or code
3. **Integration-First**: Integrations (scheduling, payments, email) are core functionality, not add-ons
4. **Multi-Tenant by Design**: Every data table has tenant isolation from day one
5. **Event-Sourced Interactions**: All client touchpoints are discrete, timestamped transactions enabling rich analytics
6. **Platform Separation**: Coaching-specific logic lives in the application layer; the platform engine is vertical-agnostic
7. **Transparent Pricing**: Infrastructure at cost; value captured through platform features, not hosting markup
8. **Mobile-Ready**: Coaches are mobile workers; the platform must work on the go
9. **Template-Driven Start, AI-Driven Evolution**: Start with beautiful templates, evolve through conversation
10. **Ownership**: Coaches own their data and can leave the platform without lock-in. "If you want to leave this platform and just use your stuff, cool. Do it. We want to help you out."

