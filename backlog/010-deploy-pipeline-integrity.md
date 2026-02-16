# 010: Deploy Pipeline Data Integrity

**Priority:** Medium
**Status:** Not Started
**Affects:** Deployment flow, DigitalOcean integration

## Problem

The deployment pipeline reads architecture data from the `projects` table in the database. But since architecture edits are never synced to the database (see backlog item 001), deployments use stale or empty architecture data.

### Current flow:
1. User designs architecture in canvas → session only (not in DB)
2. User clicks deploy → backend reads `projects.architecture` from DB
3. DB has `{"components":[],"connections":[]}` (initial value from project creation)
4. Deployment generates infrastructure from empty architecture
5. Result: deployment doesn't match what the user designed

### Additional issues:
- DigitalOcean service uses placeholder Docker images (`nginx:alpine`) instead of real built images
- No CI/CD pipeline to build user's generated code into deployable images
- No staging/production environment differentiation in the deploy flow
- Deployment status tracking exists in DB but isn't surfaced well in the UI

## Dependencies

This backlog item depends on:
- **001: Session-to-Database Persistence** — architecture must be in DB before deploy can read it
- **009: Generated File Persistence** — deploy needs access to generated code files

## Implementation Approach

### Phase 1: Fix Data Integrity (after 001 is done)
Once architecture auto-syncs to DB, the deploy pipeline will automatically get the correct architecture. Verify that:
- BAC is synced to DB before deploy
- Component specs are available in DB
- Generated files are accessible

### Phase 2: Build Pipeline
Before deploying, the generated code needs to be built into Docker images:
1. Generate `Dockerfile` for each service component
2. Build images locally or via a cloud build service
3. Push images to a container registry (DigitalOcean Container Registry, Docker Hub, etc.)
4. Reference real images in the App Spec instead of `nginx:alpine`

### Phase 3: Environment Configuration
- Allow different configurations per environment (dev/staging/prod)
- Environment variables management per service
- Domain/URL configuration

## Files to Modify

| File | Change |
|------|--------|
| `src/server/services/deployment.ts` | Read architecture from DB (not just session) |
| `src/server/services/digitalocean.ts` | Replace placeholder images with real image references |
| `src/codegen/generator.ts` | Generate Dockerfiles for each service |
| `src/server/routes/preview.ts` | Ensure preview uses same architecture as deploy |

## Acceptance Criteria

- [ ] Deploy reads architecture that matches what user designed in canvas
- [ ] Generated code is built into deployable Docker images
- [ ] Deployed services match the architecture diagram
- [ ] Deployment status is accurately tracked and displayed
