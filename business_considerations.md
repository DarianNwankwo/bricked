# Brick Studio vs Railway.com

## Key Distinctions

| Aspect | Railway | Brick Studio |
|--------|---------|--------------|
| **Primary Input** | GitHub repos / Docker images | Natural language / Mermaid diagrams |
| **Canvas Purpose** | Manage deployed services | Design architecture BEFORE coding |
| **Code Generation** | None (you bring code) | LLM generates code from architecture |
| **Target User** | Developers with existing code | Anyone designing cloud apps |
| **AI Integration** | None visible | Core feature (chat, code gen) |
| **Cloud Provider** | Railway's own infra | Brick Cloud (managed DO) or BYOC |

## Brick's Unique Value Proposition

1. **Design-first** - Start with architecture, not code
2. **AI-powered** - Natural language → deployed infrastructure
3. **Code transparency** - See and export generated Terraform/Docker
4. **Cost preview** - Know costs before deploying
5. **Education** - Users understand what they're building

## What We Took From Railway (Phase 1 - Done)

- Command palette (CMD+K)
- Railway-style node cards with status indicators
- Slide-out panel with tabs instead of modals
- Environment tabs (Dev/Staging/Prod)
- Smooth canvas interactions

## What We Should Still Take (Phases 2-4)

- **Auto-inject env vars** when connecting db → service (DATABASE_URL)
- **Real-time deploy progress** with SSE log streaming
- **One-click rollbacks** with version history
- **Template marketplace** (they have 2,000+, we have 6)
- **Config-as-code** export (Terraform, Docker Compose)

---

## Core Architectural Principle: Declarative Infrastructure

Everything Brick generates must be **declarative** - users describe the desired end state, not imperative steps to reach it.

**What this means:**
- AppSpec YAML says "I want a Postgres database" not "run these 5 commands to create one"
- Terraform exports describe resources that should exist, not provisioning scripts
- Users can version control, diff, and review infrastructure changes
- Idempotent deployments - run it twice, get the same result

**Why it matters:**
- Reproducibility - same spec = same infrastructure every time
- Auditability - infrastructure is documented in code
- Portability - declarative specs can target multiple providers
- Rollback safety - previous state is just a previous spec version

This aligns with industry standards (Terraform, Kubernetes, Pulumi) and makes Brick's output usable outside of Brick itself.

---

**Bottom line:** Railway is for developers deploying existing code. Brick is for anyone turning ideas into deployed infrastructure.
