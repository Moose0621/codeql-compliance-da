# Implementation Roadmap Summary

This roadmap consolidates architecture decisions, epics (Issues #7–#17), sequencing, and target milestones for customer PoC readiness.

## 1. Milestone Timeline (Indicative)
| Week | Focus | Key Deliverables |
|------|-------|------------------|
| 1 | Architecture + Auth Skeleton | architecture.md, token exchange stub, storage ADR |
| 2 | Audit & Orchestration | AuditEvents table write path, paginated repo load, poller |
| 3 | Reporting & Metrics Base | Report metadata v1, XLSX export, coverage calc |
| 4 | Observability + Performance | Correlation + metrics, virtualization, ETag caching |
| 5 | Accessibility + Testing | Axe fixes, unit/integration tests, CI pipeline |
| 6 | FedRAMP Metrics & Docs | Compliance widgets, daily snapshots, runbooks |

## 2. Cross-Epic Dependencies
```
Auth (#8) ─┐
           ├─ Orchestration (#10) ─┐
Audit (#9) ─┘                      ├─ Reporting (#11) ─┐
                                    FedRAMP (#17)     │
Observability (#12) ────────────────┘                 │
Performance (#13) & Accessibility (#14)  ─────────────┤
Testing (#15) & Docs (#16) ───────────────────────────┘
```

## 3. Risk Register (Top 5)
| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| API rate limit throttling | Slow hydration | Medium | Central queue + adaptive backoff + ETag caching |
| Long repo list UI freeze | Poor UX | High | Virtualization + incremental pagination |
| Token misuse exposure | Security incident | Low | GitHub App only, short-lived tokens server-side |
| Metric inconsistency | Wrong compliance reporting | Medium | Daily snapshot + recalculation endpoint |
| Reporting performance (PDF) | Slow export | Medium | Async generation & Blob cache (phase 2) |

## 4. Definition of Done per Milestone
- **M1**: Frontend uses backend for all GitHub calls (even if stub), architecture doc merged.
- **M2**: Audit trail persists real events; dispatch reliability improved; repo pagination functional.
- **M3**: Exports include metadata & integrity hash; XLSX available; coverage metric displayed.
- **M4**: App Insights shows metrics; list virtualization; TTI <3s test recorded.
- **M5**: CI blocks failing tests; accessibility scan clean; >70% unit/integration coverage baseline.
- **M6**: Compliance dashboard shows coverage %, SLA latency; documentation set complete.

## 5. Success Metrics (KPIs)
| KPI | Target |
|-----|--------|
| Dispatch success rate | ≥ 99% (non-auth failures) |
| Median scan completion tracking delay | < 60s (poll to webhook future) |
| Coverage (repos scanned past 30d) | ≥ 90% |
| TTI (500 repo org synthetic) | < 3s |
| Accessibility critical issues | 0 |
| CI pass rate (main) | ≥ 95% |

## 6. Manual Validation Script Outline
1. Connect org (test org with ≥50 repos, subset with CodeQL).  
2. Trigger 3 scans concurrently; confirm optimistic status then finalization.  
3. Export PDF & CSV; verify hash matches backend recompute.  
4. Check App Insights: correlation ID traverses dispatch → completion.  
5. Accessibility: keyboard navigate repo list and export dialog.  
6. Performance: record Lighthouse metrics (desktop + mobile).  

## 7. Exit Criteria for Customer PoC
- All milestone DoD achieved
- No P1 open issues in epics #7–#17
- Runbooks accepted by customer stakeholders
- Demonstrated 1k repo synthetic test with acceptable latency snapshot logged

---
Maintained under Issue #8 & Documentation epic (#16).
