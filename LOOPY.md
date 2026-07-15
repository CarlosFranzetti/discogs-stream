# LOOPY.md — Loop Engineering Playbook for Discogs Stream

Reusable prompt loop for keeping this app functional, tight, and safe. Run the whole
cycle with `/loop` (self-paced) or paste phases individually. Every phase ends by
appending to `memorystate.md` — that file is the loop's memory.

## The Loop (one full cycle)

```
/loop Run one full Discogs Stream engineering cycle: execute Phases 1–6 from LOOPY.md
in order, appending results to memorystate.md after each phase. Do not push to GitHub
or deploy to Vercel. Stop the loop when a cycle produces no removals, no review
findings above LOW, and no security findings.
```

## Phase Prompts

### Phase 1 — Docs sync
> Audit every .md file (CLAUDE.md, README.md, PRD.md, TDD.md, docs/) against the actual
> codebase. Fix stale commands, wrong file trees, missing edge functions/tables/hooks.
> Verify every claim with grep/read before writing it. Append a "docs" entry to memorystate.md.

### Phase 2 — Green baseline
> Run `npm test`, `npm run lint`, `npm run build`. Record results in memorystate.md.
> If anything is red, fix it BEFORE proceeding — never clean up on a red baseline.

### Phase 3 — Dead code sweep
> Build an import graph of src/ (grep each file's basename for `from '.../<name>'`).
> List zero-import files, compute the transitive closure (files only imported by dead
> files), verify each candidate with a direct grep for prop-name false positives, then
> delete. Re-run test + build after EACH batch. Append removals to memorystate.md.

### Phase 4 — Code review (cheap compute)
> Spawn a Sonnet-model subagent to review the current diff and hot paths
> (MobilePlayer, usePlayer, useBackgroundVerifier, edge functions). Triage its findings
> yourself; apply only verified fixes. Append findings + outcomes to memorystate.md.

### Phase 5 — Security check (max compute)
> As Fable, audit: Supabase RLS on all tables (migrations in supabase/migrations/),
> edge-function auth (who can call what with just the anon key), token storage
> (user_tokens), CSP in vercel.json, secrets in client bundle (grep dist/ for keys),
> input validation on edge functions. Fix criticals immediately; log the rest.
> Append a "security" entry to memorystate.md.

### Phase 6 — Features & optimizations
> Propose (do not build unless asked) features and optimizations ranked by
> effort/impact, informed by what the loop learned. Append to memorystate.md under
> "Suggestions". Candidates carry over between cycles until accepted or rejected.

## Loop Rules

1. **memorystate.md is the memory** — read it at loop start, append after every phase, newest first.
2. **Never remove on red** — baseline must be green before any deletion.
3. **Test before AND after each removal batch** — a batch is ≤ 5 related files.
4. **No pushes, no deploys** — local verification only, until the user lifts the hold.
5. **Compute budget** — Sonnet/Haiku subagents for mechanical review & exploration; Fable inline for security and final judgment.
6. **Exit condition** — a full cycle with zero removals, zero >LOW review findings, zero security findings ⇒ stop the loop and report "steady state".
