# Copilot Agent Execution Plan

This document defines how to leverage GitHub Copilot Agents (and standard Copilot chat) to iteratively implement the epics (#7–#17) while preserving quality gates.

## 1. Principles
- **Small vertical slices**: Each agent run scopes one checklist block (≤ ~150 LOC change) to keep reviews focused.
- **Definition of Done embedded**: Every agent prompt restates acceptance criteria subset.
- **Fail-fast CI**: Agent-created PR must pass lint, typecheck, tests before human review.
- **No silent API scope escalation**: Permissions / secrets changes must be separate PR.

## 2. Prompt Pattern Template
```
#github-pull-request_copilot-coding-agent
Title: <Concise change>
Body:
Context: (Link epic issue + checklist item text)
Goal: (What feature enables)
Constraints: (Keep existing types stable / no UI regression / etc.)
Acceptance Criteria:
- (List)
Tasks:
- [ ] Step 1
- [ ] Step 2
Validation:
- Run: npm run lint && npm run build
- Add/Update tests: <list>
```

## 3. Epic → Agent Iteration Mapping
| Epic | Iterations (Suggested) | Example Slice |
|------|------------------------|---------------|
| #7 Architecture & Deployment | 2–3 | Add architecture doc → Add IaC skeleton → Add storage config |
| #8 Auth & Security | 4–5 | Backend token exchange → Frontend service refactor → Security headers → Retry wrapper → Rate limit handling tests |
| #9 Persistence & Audit | 3–4 | Schema + abstraction → Write endpoint → Frontend integration → Hash/provenance |
| #10 Orchestration | 4–5 | Paginated fetch → Status poller → Error taxonomy → Dispatch concurrency → Dry-run switch |
| #11 Reporting & Export | 3–4 | Metadata schema → XLSX export → Integrity hash embed → Trend snapshot |
| #12 Observability | 3 | Correlation ID + logging → Metrics emission → KQL docs commit |
| #13 Performance | 3–4 | Virtualized list → ETag caching → Bundle analysis & code split → Perf test script |
| #14 Accessibility & UX | 2–3 | Baseline audit fixes → Live regions & focus mgmt → Final audit pass |
| #15 Testing & Pipeline | 3–4 | Test harness & configs → Unit tests → Integration (MSW) → Playwright smoke |
| #16 Documentation | 2–3 | Docs index + deployment → Operations runbook → Compliance evidence guide |
| #17 FedRAMP Metrics | 3 | Metrics spec + backend aggregation → UI widgets → Export integration |

## 4. Sequencing (Critical Path)
1. #7 + base of #8 (token model) → unblock secure backend calls.
2. #9 audit persistence before advanced reporting (#11, #17).
3. #10 orchestration improvements before performance (#13) to stabilize behavior.
4. #15 CI must exist prior to heavy iteration on performance & accessibility.
5. #17 depends on #9 (events) + #11 (report fields) + #12 (some metrics).

## 5. Environment Strategy for Agent PRs
| Env | Branch Strategy | Purpose |
|-----|-----------------|---------|
| Dev | feature/* via PR | Fast iteration; ephemeral deploy preview |
| Test | staging branch | Aggregated validation before prod release |
| Prod | main (tagged) | Customer PoC demo |

## 6. Validation Matrix
| Change Type | Required Checks |
|-------------|-----------------|
| Backend function | Lint, unit tests, integration tests (MSW) |
| GitHub service change | Retry logic test + rate limit mock scenario |
| UI component | Story snapshot (future) + accessibility axe scan |
| Export/report | Hash determinism test + schema version test |

## 7. Example Concrete Agent Run (Auth Token Exchange)
```
#github-pull-request_copilot-coding-agent
Title: feat(auth): add GitHub App installation token exchange function
Body:
Context: Implements checklist item 'Backend function: POST /api/token' from Epic #8.
Goal: Provide secure server-side token minting, eliminating PAT usage.
Constraints: No frontend refactor yet; provide stub endpoint returning mock until secret present.
Acceptance Criteria:
- Endpoint POST /api/token returns JSON with placeholder token field.
- Includes TODO referencing secret retrieval from Key Vault.
- Added unit test validating 200 + shape.
Tasks:
- [ ] Create function dir api/token/index.ts
- [ ] Implement handler with validation
- [ ] Add test token.test.ts using Vitest
Validation:
- Run lint & build
```

## 8. Rollback & Safety
- Each slice avoids cross-cutting refactors.
- Introduce new modules alongside old; switch consumption only after verification (feature flag pattern where feasible).

## 9. Metrics of Progress
| Metric | Source |
|--------|--------|
| Lead time per slice | PR merged timestamps |
| Scan dispatch success rate | App Insights custom metric |
| Coverage % | DailyMetrics table |
| Accessibility violations | Axe CI report |

## 10. Completion Definition for PoC Readiness
- All epics have ≥90% checklist completion
- FedRAMP metrics visible & exported
- CI green 5 consecutive main merges
- Performance budget (TTI <3s, repo list scroll <16ms) validated

---
Maintained under Documentation epic (#16).