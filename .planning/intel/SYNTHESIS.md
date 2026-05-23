# Ingest Synthesis Summary

**Mode:** new (fresh bootstrap, no existing `.planning/` context)
**Date:** 2026-05-20

---

## Doc Counts
- Total: 5
- ADR: 0
- SPEC: 2 (TDD.md, all-sprints-design.md)
- PRD: 1 (PRD.md)
- DOC: 2 (CLAUDE.md, all-sprints implementation plan)
- UNKNOWN: 0

## Decisions
- Locked ADRs: 0
- No ADRs ingested in this pass. See `decisions.md`.

## Requirements
- Total: 8 product requirements + cross-cutting goals/metrics/open-questions
- IDs:
  - REQ-collection-import-csv (shipped)
  - REQ-discogs-account-sync (P0 next)
  - REQ-playback-engine (shipped, hardening)
  - REQ-volume-keyboard-controls (P0 in progress; shortcut mapping superseded by SPEC)
  - REQ-persistent-user-state (P0)
  - REQ-now-playing-panel (P1 design)
  - REQ-playlist-wantlist-reset (P0 bug fix)
  - REQ-vinyl-rendering (shipped)
- See `requirements.md` for full acceptance criteria.

## Constraints
- Total: 18 constraints across architecture, schema, component contracts, security/NFR, tests
- Breakdown:
  - api-contract: 9
  - schema: 6
  - nfr: 7 (counts overlap due to multi-tag constraints)
- Authoritative keyboard shortcut mapping lives here (SPEC wins over PRD/DOC). See `constraints.md` (CONSTRAINT-keyboard-shortcuts).

## Context Topics
- 14 topics extracted from CLAUDE.md (current architecture, conventions, data flow, edge functions, DB tables, env, deployment)
- 1 topic for the all-sprints implementation plan (task-by-task breakdown of the four sub-projects)
- See `context.md`.

## Conflicts
- BLOCKERS: 0
- WARNINGS (competing variants): 0
- INFO (auto-resolved): 2
  - SPEC > PRD on keyboard shortcuts
  - SPEC > DOC (CLAUDE.md current state) on keyboard shortcuts
- Full report: `/Users/carlosfranzetti/Documents/GITHUB/discogs-stream/.planning/INGEST-CONFLICTS.md`

## Cycle Detection
- Cross-ref graph contains 0 cycles. Cross-refs point to source code paths, not to other classified docs.

## Pointers (for gsd-roadmapper)
- Requirements → `/Users/carlosfranzetti/Documents/GITHUB/discogs-stream/.planning/intel/requirements.md`
- Constraints (SPEC) → `/Users/carlosfranzetti/Documents/GITHUB/discogs-stream/.planning/intel/constraints.md`
- Decisions (ADR) → `/Users/carlosfranzetti/Documents/GITHUB/discogs-stream/.planning/intel/decisions.md`
- Context (DOC) → `/Users/carlosfranzetti/Documents/GITHUB/discogs-stream/.planning/intel/context.md`
- Conflicts report → `/Users/carlosfranzetti/Documents/GITHUB/discogs-stream/.planning/INGEST-CONFLICTS.md`

## Status
READY — no blockers, no competing variants. Safe to route to roadmapper.
