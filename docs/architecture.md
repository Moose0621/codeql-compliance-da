# Architecture & Deployment Plan

## 1. Goals
Provide a secure, scalable, low‑ops Azure deployment for the Enterprise CodeQL Security Dashboard supporting:
- FedRAMP-aligned continuous CodeQL scan visibility
- On-demand workflow dispatch at scale (1k+ repos)
- Durable audit & reporting
- Future extensibility (webhooks, multi-tenant, RBAC)

## 2. High-Level Diagram
```
+----------------------+         +------------------+        +-------------------------+
|  User Browser (SPA)  | <-----> | Azure Static Web |  /api  |  Azure Functions (Node) |
| React + Tailwind     |         | App (Front Door) |------->|  Auth, Proxy, Audit     |
+----------+-----------+         +---------+--------+        +-----------+-------------+
           |                                |                          |
           | GitHub REST (via backend)      |                          |
           |                                |                          |
           v                                v                          v
   GitHub App (Installation)          Key Vault                Storage (Table/Blob)
           |                                |                          |
           v                                |                          |
   GitHub API (Repos, Actions, Code Scanning, App)  <------->  App Insights (Logs/Metrics)
```

## 3. Components
| Component | Responsibility | Tech/Service |
|-----------|----------------|--------------|
| Frontend SPA | UX, visualization, export generation (client side except integrity hashing origin-signed) | React 19 + Vite + SWA |
| Functions API | Token exchange, GitHub API proxy (rate-limit mediation), audit writes, report aggregation | Azure Functions (Node, isolated) |
| GitHub App | AuthN source of truth; installation access tokens | GitHub Apps |
| Storage | Append-only audit log, daily aggregates, export provenance | Azure Table Storage (initial) + Blob (PDF caching) |
| Key Vault | GitHub App private key, encryption keys | Azure Key Vault |
| App Insights | Metrics, logs, distributed correlation | Application Insights |
| (Future) Webhook Receiver | Inbound workflow run events to replace polling | Azure Functions HTTP trigger |

## 4. Authentication & Authorization
- **GitHub App** with minimal permissions: `actions:read`, `contents:read`, `metadata:read`, `security_events:read`, `workflows:write` (dispatch) – validate if `workflows:write` still required; else workflow dispatch via `actions:write`.
- Browser -> Functions: obtains ephemeral JWT (Static Web App built-in auth optional; for PoC keep public + signed requests with HMAC header).
- Functions: Creates installation access token (valid ~1hr), caches in memory keyed by installation id with early refresh (80% TTL).
- All GitHub calls from backend only (PAT removed from client).

## 5. Data Flows
### 5.1 Connect Organization
1. User selects installation (or enters org slug).
2. Frontend calls `GET /api/org/:org/summary`.
3. Functions fetches repos (paginated) + CodeQL workflow presence + latest run status + findings snapshot.
4. Response streamed (chunked pagination) to incrementally hydrate UI.

### 5.2 Dispatch Scan
1. User clicks "Request Scan" -> POST `/api/repos/:repo/dispatch`.
2. Backend triggers workflow dispatch, writes `scan_dispatched` event to audit table.
3. Poller or (later) webhook updates status -> writes `scan_completed` with duration & findings counts.

### 5.3 Findings Aggregation
- On repo list retrieval: parallel limited concurrency (e.g. 5) calls to code scanning alerts -> converted to severity counts.
- Daily aggregate function (timer trigger) rolls up coverage + SLA metrics -> writes `daily_metrics` row.

### 5.4 Report Export
1. Frontend requests `/api/report?format=pdf|csv|json|xlsx`.
2. Backend composes authoritative payload (ensures integrity), generates hash.
3. For PDF/XLSX heavy generation optionally done client-side with signed JSON (phase 2). PoC: server returns ready binary (PDF) / buffer.
4. Audit event `report_generated` with hash stored.

## 6. Storage Schema (Azure Table)
Partition keys chosen to optimize typical queries.

### Table: `AuditEvents`
| Field | PK | RK | Notes |
|-------|----|----|-------|
| partitionKey | `ORG#<org>` |  | |
| rowKey | `<timestamp>_<eventId>` |  | ensures chronological sort |
| event_type |  |  | scan_dispatched, scan_completed, report_generated |
| repo |  |  | full_name |
| user |  |  | initiating user handle |
| status |  |  | success/failure |
| duration_ms |  |  | for completed scans |
| findings |  |  | JSON aggregate counts |
| hash |  |  | for reports |

### Table: `DailyMetrics`
| PK | RK | Fields |
|----|----|--------|
| ORG#<org> | DATE#YYYYMMDD | coverage_pct, repos_total, repos_scanned_30d, median_scan_minutes, p95_scan_minutes, total_findings, critical_open |

### Blob Containers
- `exports/` stored PDF/XLSX (optional caching) named by report id.

## 7. Operational Concerns
| Concern | Approach |
|---------|----------|
| Rate limiting | Central proxy queues + exponential backoff (Jitter) |
| Secrets rotation | Key Vault; Functions uses managed identity to fetch at cold start (cache 15m) |
| Observability | Correlation ID injected (request header or generated) -> included in all logs, metrics customEvents for scan lifecycle |
| Error taxonomy | Map GitHub status codes to: AUTH, PERMISSION, RATE_LIMIT, NOT_FOUND, UNKNOWN |
| Scaling | SWA static; Functions consumption plan (premium optional) – fronted by concurrency caps |

## 8. Deployment Pipeline
1. GitHub Actions workflow `ci.yml`: lint, typecheck, unit tests, build.
2. On main merge -> `deploy.yml`: build frontend, deploy SWA, deploy Functions (via SWA build or separate func artifact), run smoke test (dispatch dry-run).
3. Environment promotion: `dev` (auto), `test` (manual approval), `prod` (manual + tag).

## 9. Milestones
| Milestone | Issues (Epics) | Outcome |
|-----------|----------------|---------|
| M1 Core Platform | #7 #8 | Secure architecture doc + auth backend skeleton |
| M2 Persistence & Orchestration | #9 #10 | Durable audit + reliable dispatch scaling |
| M3 Reporting & Compliance | #11 #17 | Enhanced metrics + FedRAMP indicators |
| M4 Performance & UX | #12 #13 | Large org performance + accessibility AA |
| M5 Quality & Docs | #14 #16 | CI pipeline + runbooks & deployment docs |

## 10. Risk & Mitigation
| Risk | Mitigation |
|------|------------|
| GitHub API rate exhaustion | Adaptive backoff + partial hydration + ETag caching |
| Large org latency | Incremental pagination + virtualization (#12) |
| Polling inefficiency | Webhook receiver future (#10 dependency) |
| Token misuse | Switch to GitHub App only; short-lived tokens never stored client side |
| Compliance metric drift | Daily timer job + on-demand recompute fallback |

## 11. Future Enhancements
- Webhook event ingestion (Actions workflow_run) to eliminate polling
- Multi-tenant (org segmentation, RBAC roles)
- SSO integration (Entra ID) using SWA auth or front-end provider
- Alerting integration (Teams/Slack) for failed scans or SLA breaches

---
Document maintained under Issue #7.
