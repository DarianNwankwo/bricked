# Brick CLI

[![npm version](https://img.shields.io/badge/npm-v0.2.0-blue)](https://www.npmjs.com/package/brick-cli)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-green)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![DigitalOcean](https://img.shields.io/badge/Deploy-DigitalOcean-0080FF)](https://www.digitalocean.com/products/app-platform)

Brick is an AI-powered CLI and UI for turning intent into deployable architecture and code artifacts.

Current implementation direction is **BAC-first**:
- BAC (Brick App Contract) is the canonical contract layer.
- OpenRouter is the default model router.
- Targeted file edits are the default update strategy.
- BAC includes explicit node and edge contracts (`systemContracts.nodes`, `systemContracts.edges`).

## Quick Start

### Prerequisites
- Node.js 18+
- [doctl](https://docs.digitalocean.com/reference/doctl/) installed/authenticated for deployment
- One LLM API key: `OPENROUTER_API_KEY` (preferred), `ANTHROPIC_API_KEY`, or `OPENAI_API_KEY`

### Environment Setup
Brick now auto-loads `.env` and `.env.local` from project root on CLI startup.

Example `.env`:
```bash
OPENROUTER_API_KEY=your_key_here
BRICK_MODEL=anthropic/claude-sonnet-4
```

### Install and Run
```bash
npm install
npm run dev -- create "A React app with API and PostgreSQL" -o appspec.yaml -y
```

## BAC Workflow

Generate AppSpec + Mermaid + BAC from inline prompt:
```bash
npm run dev -- create "AI-native coaching platform with CRM and booking" \
  -o /tmp/coach.appspec.yaml \
  -d /tmp/coach.mmd \
  --bac-output /tmp/coach.bac.json \
  -y
```

Generate from a vertical description file:
```bash
npm run dev -- create \
  --description-file ./coach_vertical.md \
  -o /tmp/coach.appspec.yaml \
  -d /tmp/coach.mmd \
  --bac-output /tmp/coach.bac.json \
  -y
```

Quick BAC contract check:
```bash
cat /tmp/coach.bac.json | jq '{nodes: .systemContracts.nodes|length, edges: .systemContracts.edges|length}'
```

## UI Contract Editing

Launch UI:
```bash
npm run dev -- ui
```

In builder mode:
- Click a node to edit:
  - description
  - input contract
  - output contract
  - implementation notes
- In the same panel, edit **Connection Data Contracts** for inbound/outbound edges:
  - edge label
  - source output contract
  - target input contract
  - notes

These edits are synced to BAC through:
- `PUT /api/component-specs`
- `PUT /api/connection`

BAC endpoints:
- `GET /api/bac`
- `PUT /api/bac`

## Key Commands

| Command | Description |
|---------|-------------|
| `brick create [description]` | Generate architecture from text and/or `--description-file` |
| `brick build <diagram.mmd>` | Compile Mermaid diagram to AppSpec YAML |
| `brick chat` | Interactive architecture design (`/build` can output BAC) |
| `brick ui` | Launch visual architecture editor |
| `brick deploy <appspec.yaml>` | Deploy to DigitalOcean App Platform |
| `brick validate <appspec.yaml>` | Validate AppSpec |
| `brick server` | Start backend API server |

See `docs/cli-reference.md` for full options.

## Mermaid Shape Conventions

| Shape | Component Type |
|-------|----------------|
| `[Rectangle]` | Service |
| `([Stadium])` | Static Site |
| `[(Cylinder)]` | Database |
| `((Circle))` | Worker |
| `{{Hexagon}}` | Job |

## Known Gaps

- `brick create` currently may emit valid but unlabeled Mermaid edges; edge contract details are richer in BAC/UI than in raw generated diagram text.
- BAC compiler as strict source of truth (`BAC -> graph -> IR -> code`) is in progress; current flow still includes Mermaid-first paths.

## Documentation

- `docs/getting-started.md`
- `docs/cli-reference.md`
- `docs/architecture.md`
- `docs/architecture-decisions.md`
- `docs/examples.md`

## License

MIT
