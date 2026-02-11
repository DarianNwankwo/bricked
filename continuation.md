# Brick Studio - Development Continuation

## Project Overview

**Brick Studio** is a visual cloud infrastructure designer that translates natural language or visual architecture diagrams into deployed DigitalOcean infrastructure. Think Figma meets Vercel - users design their architecture visually or describe it in chat, and Brick deploys it with one click.

### Core Vision
- **Fully managed**: Users never connect their own DO account - Brick owns the infrastructure
- **Visual first**: Canvas-based architecture design like Eraser.io
- **AI-assisted**: Chat with AI to generate/modify architectures
- **One-click deploy**: No infrastructure knowledge needed

---

## What's Been Built

### 1. CLI Tool (`src/cli/`)
- `brick build <diagram.mmd>` - Build from Mermaid diagram
- `brick create "description"` - Create from natural language
- `brick chat` - Interactive architecture design
- `brick ui` - Launch visual web interface
- `brick server` - Start backend API server
- `brick validate` - Validate AppSpec
- `brick deploy` - Deploy to DigitalOcean

### 2. Web UI (`src/cli/commands/ui.ts`)
A single-file React application with:

**Pages:**
- **Auth Screen** - Login/signup with modern dark design
- **Dashboard** - Project list with sidebar navigation
- **Editor** - Three-panel layout:
  - Left: AI Chat assistant
  - Center: Visual canvas (light bg with dot pattern)
  - Right: Cost breakdown panel
- **Settings** - AI model configuration

**Features:**
- Visual component palette (Service, Database, Static Site, Worker, Job)
- Drag-and-drop component placement
- Connection drawing between components
- Real-time cost estimation
- Markdown documentation editor
- Code generation from architecture
- Deploy modal with progress steps

**Design:**
- Dark theme with Indigo accent (#6366F1)
- Inter + JetBrains Mono fonts
- Iconify Solar icons throughout
- Glass morphism effects
- Smooth animations

### 3. Backend Server (`src/server/`)

**Database (`db/`):**
- In-memory store (swappable to Postgres)
- Models: User, Project, Environment, Deployment, UsageRecord
- Auto-seeds test user on startup

**Routes:**
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login (returns JWT)
- `GET /api/auth/me` - Get current user
- `GET /api/projects` - List user's projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project details
- `PATCH /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/deployments/:projectId/:env` - Start deployment
- `GET /api/deployments/:id` - Get deployment status
- `DELETE /api/deployments/:projectId/:env` - Stop deployment

**Services:**
- `digitalocean.ts` - DO App Platform API integration
- `deployment.ts` - Deployment orchestration with cost calculation

**Auth:**
- JWT-based authentication
- Password hashing with PBKDF2

### 4. Core Pipeline (`src/`)

**Parser (`parser/`):**
- Mermaid flowchart parser
- Extracts nodes, edges, subgraphs
- Supports brick annotations (`%% brick:name=app`)

**Transformer (`transformer/`):**
- Converts AST to intermediate representation (IR)
- Infers component types from Mermaid shapes
- Handles connections

**Generator (`generator/`):**
- Generates DigitalOcean AppSpec YAML from IR
- Applies sensible defaults

**Deployer (`deployer/`):**
- `doctl.ts` - DigitalOcean CLI wrapper
- `cost-estimator.ts` - Real-time pricing estimates

**LLM (`llm/`):**
- Anthropic Claude integration
- OpenRouter support for multiple models
- Architecture generation prompts
- Streaming responses

**Codegen (`codegen/`):**
- Generates boilerplate code from architecture
- Plans file structure
- Creates component implementations

---

## Current State

### Running Services
- **UI Server**: http://localhost:3333
- **Backend API**: http://localhost:4000

### Test Credentials
```
Email:    test@brick.studio
Password: password123
```

### Sample Data
On server startup, seeds:
- Test user (above credentials)
- "E-Commerce Core" project with:
  - Web Dashboard (static_site)
  - Auth Service (service)
  - Core API (service)
  - PostgreSQL (database)

---

## How to Run

```bash
# Build the project
npm run build

# Start backend server (port 4000)
node dist/bin/brick.js server

# Start UI server (port 3333) - in another terminal
node dist/bin/brick.js ui

# Or run both with dev mode
npm run dev -- server  # Terminal 1
npm run dev -- ui      # Terminal 2
```

---

## Recent Session: Railway.com-Inspired UX (2026-01-31)

### What Was Implemented

#### 1. Node Snapping Bug Fix
**Problem:** Clicking a node would reset its position because the `useEffect` was syncing nodes on every parent re-render.

**Solution:** Added refs to track initial mount and component IDs. Nodes only sync when:
- Initial mount
- Components are actually added/removed
- Existing node positions are preserved during updates

```javascript
const isInitialMount = React.useRef(true);
const prevComponentCount = React.useRef(components.length);
const prevComponentIds = React.useRef(components.map(c => c.id).join(','));
```

#### 2. Railway-Style Node Cards
- **Colored left border:** 4px accent stripe indicating component type via CSS variable `--node-accent-color`
- **Deployment status animations:** `.deploying`, `.live`, `.failed` classes
- **Status dots:** Pulsing animations for deploying state, glow effects for live/failed
- **Smooth hover transitions:** Card lift effect on hover

#### 3. Command Palette (CMD+K)
**New Component:** `CommandPalette`

- Opens with CMD/Ctrl+K
- Fuzzy search filtering across 17 commands
- Arrow key navigation + Enter to execute
- Commands grouped by category:
  - **Add Component:** Service, Database, Cache, Queue, Worker, Static Site, Storage
  - **Actions:** Deploy, Export YAML, Save Project, Auto Layout
  - **Navigation:** View Architecture/Code/Docs, Back to Projects

**Important:** Component uses `React.useState`, `React.useMemo`, etc. (not bare hook names) because it's defined outside the App function.

#### 4. Slide-Out Detail Panel with Tabs
**Replaces:** Previous modal-style component detail view

- Full viewport height panel sliding from right
- Click-away overlay to close
- **4 tabs:**
  - **Config:** Component specification form
  - **Code:** Preview of generated code structure
  - **Logs:** Deployment logs display
  - **Cost:** Component cost breakdown

**State:** `detailTab` tracks active tab ('config' | 'code' | 'logs' | 'cost')

#### 5. Environment Tabs
**Location:** Floating above canvas (centered)

- Three environments: Development, Staging, Production
- Visual status indicators (gray/pulsing blue/green with glow)
- Only visible in builder mode

### Key Code Locations in `ui.ts`

| Feature | Approximate Lines |
|---------|-------------------|
| Node snapping fix | ~5353-5390 (Canvas useEffect) |
| RF node CSS | ~1871-1970 |
| Command palette CSS | ~2081-2180 |
| CommandPalette component | ~5695-5820 |
| Command handler | After `goToProjects` function (~6620) |
| Detail panel tabs CSS | ~2600-2650 |
| Environment tabs CSS | ~2020-2080 |

### Gotchas & Lessons Learned

1. **Hook initialization order:** `handleCommandPaletteCommand` was initially defined before the functions it referenced (`exportYaml`, `saveProject`, etc.). Had to move it after those definitions.

2. **React hooks in standalone components:** The `CommandPalette` component is defined outside `App()`, so it can't use the destructured hooks. Must use `React.useState`, `React.useEffect`, etc.

3. **CSS variables for dynamic styling:** Used `--node-accent-color` CSS variable to pass component type color from React to CSS for the left border stripe.

---

## What's Left To Do

### From Railway Analysis - Remaining Phases

#### Phase 2 - Service Configuration UX (Partially Done)
- [x] Command palette
- [x] Slide-out panel with tabs
- [ ] Auto-inject DATABASE_URL when connecting db → service

#### Phase 3 - Deployment Model
- [ ] Cloud connection UI ("Connect Your Cloud" settings)
- [ ] Deploy target toggle (Brick Cloud vs BYOC)
- [ ] Real-time deploy progress with SSE log streaming

#### Phase 4 - Code & Export
- [ ] Better code preview panel
- [ ] Export options (Terraform, Docker Compose)
- [ ] GitHub integration

### Original Priority Items

1. **Persist Data** - Switch from in-memory to SQLite or Postgres
2. **Complete Deployment Flow** - Test with real DO token, implement log streaming
3. **Billing Integration** - Stripe subscription setup
4. **Custom Domains** - `*.brick.run` subdomain routing

---

## File Structure

```
brick-by-brick/
├── bin/brick.ts                 # CLI entry point
├── src/
│   ├── cli/
│   │   ├── index.ts             # CLI setup
│   │   └── commands/
│   │       ├── ui.ts            # Web UI (huge file - React app)
│   │       ├── server.ts        # Backend server command
│   │       ├── build.ts         # Build from Mermaid
│   │       ├── create.ts        # Create from description
│   │       ├── chat.ts          # Interactive chat
│   │       ├── deploy.ts        # Deploy command
│   │       └── validate.ts      # Validate AppSpec
│   ├── server/
│   │   ├── index.ts             # Express server
│   │   ├── db/
│   │   │   ├── schema.ts        # Data models
│   │   │   └── client.ts        # In-memory DB + seeding
│   │   ├── routes/
│   │   │   ├── auth.ts          # Auth endpoints
│   │   │   ├── projects.ts      # Project CRUD
│   │   │   └── deployments.ts   # Deployment management
│   │   ├── services/
│   │   │   ├── digitalocean.ts  # DO API integration
│   │   │   └── deployment.ts    # Deployment orchestration
│   │   └── middleware/
│   │       └── auth.ts          # JWT auth middleware
│   ├── parser/                  # Mermaid parser
│   ├── transformer/             # AST to IR
│   ├── generator/               # IR to AppSpec
│   ├── deployer/                # DO deployment
│   ├── llm/                     # AI integration
│   ├── codegen/                 # Code generation
│   ├── validator/               # AppSpec validation
│   └── types/                   # TypeScript types
├── examples/                    # Example architectures
├── data/
│   └── architecture_templates.json  # Template definitions
├── continuation.md              # This file
├── package.json
└── tsconfig.json
```

---

## Environment Variables

```bash
# Required for deployments
BRICK_DO_TOKEN=your_digitalocean_api_token

# Optional
BRICK_JWT_SECRET=your_jwt_secret  # Defaults to dev secret
ANTHROPIC_API_KEY=your_key        # For Claude AI
OPENROUTER_API_KEY=your_key       # For other models
PORT=4000                         # Backend port
```

---

## Design Assets

- **UI Mockup**: See `prompt.txt` for detailed design specifications
- **Color Palette**:
  - Primary: #6366F1 (Indigo)
  - Background: #0A0A0A (dark) / #FAFAFA (light canvas)
  - Service: #6366F1, Database: #22C55E, Static: #A855F7, Worker: #F59E0B, Job: #EC4899
