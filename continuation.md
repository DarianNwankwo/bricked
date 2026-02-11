# Continuation Handoff - Brick
Last updated: 2026-02-11

## 1) Product Direction (Current Alignment)
- Brick is an AI-first platform to help users build, deploy, and iterate applications.
- Canonical abstraction is **BAC (Brick App Contract)**.
- AI-native behavior is encouraged, not hard-mandatory per product, but AI opportunity assessment is mandatory.
- First anchor vertical is **coach platform** (CRM + meetings/booking + landing page operations + AI copilot potential).

## 2) Accepted Architecture Decisions
- D-001: AI-native implementation optional per app, AI opportunity assessment required.
- D-002: Default model routing is **OpenRouter**.
- D-003: Default change strategy is **targeted edits** over full regeneration.
- D-004: BAC must include explicit **node and edge contracts**.

Primary doc:
- `/Users/work/Documents/bricked/bricked/docs/architecture-decisions.md`

## 3) What Is Implemented

### 3.1 BAC Core
- Added BAC schema/types:
  - `/Users/work/Documents/bricked/bricked/src/types/bac.ts`
- Added BAC derivation:
  - `/Users/work/Documents/bricked/bricked/src/bac/derive.ts`
- Added BAC validation:
  - `/Users/work/Documents/bricked/bricked/src/bac/validate.ts`
- Exports wired:
  - `/Users/work/Documents/bricked/bricked/src/bac/index.ts`
  - `/Users/work/Documents/bricked/bricked/src/types/index.ts`
  - `/Users/work/Documents/bricked/bricked/src/index.ts`

### 3.2 BAC Contract Surfaces
- BAC now includes:
  - `systemContracts.nodes[]` with `inputContract` and `outputContract`
  - `systemContracts.edges[]` with `sourceOutputContract` and `targetInputContract`

### 3.3 CLI
- `brick create` supports:
  - `--bac-output <file>`
  - `--description-file <file>` (description arg optional; supports inline + file merge)
- `brick chat` supports:
  - `--bac-output <file>` on `/build`
- File:
  - `/Users/work/Documents/bricked/bricked/src/cli/commands/create.ts`
  - `/Users/work/Documents/bricked/bricked/src/cli/commands/chat.ts`

### 3.4 Env Loading
- CLI now auto-loads `.env` and `.env.local` from cwd.
- Files:
  - `/Users/work/Documents/bricked/bricked/src/utils/env-loader.ts`
  - `/Users/work/Documents/bricked/bricked/bin/brick.ts`

### 3.5 UI / API (BAC + Contracts)
- BAC endpoints:
  - `GET /api/bac`
  - `PUT /api/bac`
- Added missing architecture replace route (undo/redo path):
  - `POST /api/architecture`
- Added component spec sync endpoint:
  - `PUT /api/component-specs`
- Connections now support contract metadata:
  - `POST /api/connection` accepts label + contract
  - `PUT /api/connection` updates label + contract
- Node detail panel now supports:
  - node input/output contracts
  - per-connection data contracts (label, source output, target input, notes)
- File:
  - `/Users/work/Documents/bricked/bricked/src/cli/commands/ui.ts`

### 3.6 Codegen Strategy
- Targeted-edit default implemented for generation in UI flow.
- Existing files can be edited via code-edit path instead of full regen by default.
- Files:
  - `/Users/work/Documents/bricked/bricked/src/codegen/generator.ts`
  - `/Users/work/Documents/bricked/bricked/src/codegen/index.ts`
  - `/Users/work/Documents/bricked/bricked/src/cli/commands/ui.ts`

### 3.7 Tests
- BAC tests:
  - `/Users/work/Documents/bricked/bricked/tests/bac/contract.test.ts`
- Latest result in this session:
  - `npm run lint` passed
  - `npx vitest run tests/bac/contract.test.ts` passed (3 tests)

## 4) Current Known Gap (Important)
- `brick create` can still output Mermaid diagrams with unlabeled edges even when BAC has richer contract info.
- Interpretation:
  - Not a parser failure.
  - Gap between generated Mermaid representation and contract richness expected for handoff.
- Impact:
  - BAC/UI contract data is ahead of Mermaid text output.
- Likely next fix:
  - enforce edge label/contract enrichment in create/chat generation path (or post-process pass).

## 5) Resolved vs Unresolved Findings

Resolved:
- Missing `POST /api/architecture` undo/redo path.
- Manual component ID collision risk.
- `.env` not loading for CLI.

Still open / not addressed in this sequence:
- GitHub OAuth path mismatch (`src/server/routes/github.ts`, `src/server/index.ts`, UI popup flow).
- DigitalOcean static site source completeness risk (`src/server/services/digitalocean.ts`).

## 6) Notion Status
- Connected Notion workspace (MCP) is active.
- Target canonical page remains inaccessible from MCP:
  - `https://www.notion.so/codex-3040fb3e28af80e385a7dda44cee9226?source=copy_link`
  - API returns `object_not_found`.
- Working fallback page used and updated:
  - `https://www.notion.so/304e2e1c8696817fa6dddf644bb80957`

## 7) Resume Commands

### 7.1 Generate from vertical file + BAC output
```bash
cd /Users/work/Documents/bricked/bricked
npm run dev -- create \
  --description-file ./coach_vertical.md \
  -o /tmp/coach.appspec.yaml \
  -d /tmp/coach.mmd \
  --bac-output /tmp/coach.bac.json \
  -y
```

### 7.2 Inspect BAC node/edge contract counts
```bash
cat /tmp/coach.bac.json | jq '{nodes: .systemContracts.nodes|length, edges: .systemContracts.edges|length}'
```

### 7.3 Validate current BAC tests
```bash
npm run lint
npx vitest run tests/bac/contract.test.ts
```

## 8) Recommended Next Steps
1. Make BAC the strict compile source (`BAC -> graph -> IR -> generation`) instead of Mermaid-first fallback.
2. Add contract completeness gating before code generation/deploy:
   - fail if required node/edge contracts are missing.
3. Enrich/normalize Mermaid output from `create` so edges include contract-relevant labels.
4. Resolve canonical Notion page access for continuous architecture log sync.

## 9) Working Rule
- Do not introduce a second abstraction path.
- Continue converging all generation/iteration through BAC as the contract-of-record.
