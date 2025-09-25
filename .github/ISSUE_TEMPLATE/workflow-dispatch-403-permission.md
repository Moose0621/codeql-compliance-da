---
name: "Bug: 403 on workflow dispatch (scan workflow)"
about: "Fix 403 'Resource not accessible by personal access token' when triggering workflow_dispatch for scan workflow"
title: "fix: 403 workflow_dispatch permission for scan workflow"
labels: ["type:bug","area:workflows","priority:high"]
assignees: []
---

<!-- markdownlint-disable -->
# 403 Workflow Dispatch Permission Failure

## Summary

Automated scan dispatch fails for `demo-vulnerabilities-ghas` (or equivalent scan workflow) with:

```
Failed to dispatch scan for demo-vulnerabilities-ghas: GitHub API error: 403
{
  "message": "Resource not accessible by personal access token",
  "documentation_url": "https://docs.github.com/rest/actions/workflows#create-a-workflow-dispatch-event",
  "status": "403"
}
```

## Impact
- On‑demand or scheduled security/compliance scans cannot be triggered programmatically.
- Reduced observability and potential delay in surfaced vulnerabilities.
- Downstream automation (scorecards, compliance exports) may lag.

## Environment / Context
- Repo: `Moose0621/codeql-compliance-da`
- Branch: `main`
- Trigger: REST call to `POST /repos/:owner/:repo/actions/workflows/<scan-workflow>.yml/dispatches` with `{ "ref": "main" }`.
- Auth: Personal Access Token (PAT) (exact scopes TBD).

## Hypotheses / Likely Root Causes
| # | Category | Description | Verification | Fix |
|---|----------|-------------|--------------|-----|
| 1 | PAT Scope | Missing classic `workflow` scope or fine‑grained Actions: *Read & write* | Check token scopes | Regenerate PAT with required scopes |
| 2 | Fine‑grained PAT | Repo not explicitly selected or Actions write not granted | PAT settings page | Add repo + permissions |
| 3 | Repo Settings | Actions workflow permissions = *Read* only | Settings > Actions > General | Set to *Read and write* |
| 4 | Workflow Ref | File not on default branch or wrong filename/ID | Confirm path `.github/workflows/*.yml` on `main` | Use correct name / ensure merge to main |
| 5 | First Run Gate | Newly added workflow not enabled yet | Actions tab shows enable banner | Manually enable or push trivial change |
| 6 | SSO / Org Policy | PAT not authorized for org SSO | Attempt any org API call | Re-authorize PAT via SSO flow |
| 7 | App vs PAT | Using GitHub App lacking `actions:write` | Headers show App auth | Update App permissions |

## Reproduction Steps
1. Use current dispatch utility (or curl below).
2. Execute:
   ```bash
   curl -i -X POST \
     -H "Accept: application/vnd.github+json" \
     -H "Authorization: Bearer $PAT" \
     https://api.github.com/repos/Moose0621/codeql-compliance-da/actions/workflows/demo-vulnerabilities-ghas.yml/dispatches \
     -d '{"ref":"main"}'
   ```
3. Observe HTTP 403 with the error JSON.

## Expected vs Actual
| Aspect | Expected | Actual |
|--------|----------|--------|
| HTTP Status | 204 No Content | 403 Forbidden |
| Side Effect | New workflow run appears | No run triggered |
| Logging | Success log | Error logged |

## Acceptance Criteria
- [ ] Dispatch via curl returns 204.
- [ ] Scan workflow run appears in Actions with correct ref & actor.
- [ ] Documented token scope requirements added to `CI-CD-SETUP.md` (or new section) & README if appropriate.
- [ ] Failing permission path now emits actionable diagnostic (scope suggestions) instead of generic message.
- [ ] Optional: Pre-flight permission self-check added (fails fast if workflow dispatch not permitted).

## Remediation Plan (Task List)
### Phase 1: Diagnose
- [ ] Confirm workflow file name & presence on `main` (`git ls-files .github/workflows | grep -i scan || demo-vulnerabilities`)
- [ ] Inspect repository Actions permissions (Settings > Actions > Workflow permissions -> ensure *Read and write*).
- [ ] Identify token type: classic vs fine‑grained.
- [ ] For classic PAT: verify scopes include `repo`, `workflow`.
- [ ] For fine‑grained PAT: verify repo is selected & Actions permission = *Read and write*.
- [ ] Attempt dispatch using a known-good admin-scoped classic PAT (control test).

### Phase 2: Implement Fix
- [ ] Regenerate / update PAT or switch to GitHub App / GITHUB_TOKEN strategy.
- [ ] (If using workflow indirection) Add controller workflow that triggers scan via `repository_dispatch` with appropriate permissions block:
  ```yaml
  permissions:
    actions: write
    contents: read
  ```
- [ ] Add pre-flight permission check utility (`src/lib/github-dispatch-check.ts`).
- [ ] Update dispatch helper to surface structured errors (403 -> missing scopes guidance).

### Phase 3: Document & Validate
- [ ] Update `CI-CD-SETUP.md` with “Workflow Dispatch Permissions” section (scopes + sample curl).
- [ ] Add troubleshooting subsection for 403 errors.
- [ ] Re-run curl & app-level dispatch; capture timestamps.
- [ ] Attach screenshot / link of successful workflow run.

## Proposed Code Addition (Utility Skeleton)
```ts
// src/lib/github-dispatch-check.ts
export async function assertWorkflowDispatchable(opts: { repo: string; workflow: string; token: string; ref?: string }) {
  const headers = { 'Accept': 'application/vnd.github+json', 'Authorization': `Bearer ${opts.token}` };
  const wfResp = await fetch(`https://api.github.com/repos/${opts.repo}/actions/workflows`, { headers });
  if (wfResp.status === 403) {
    throw new Error('403 listing workflows – token likely missing workflow/actions scope.');
  }
  if (!wfResp.ok) throw new Error(`Failed listing workflows (${wfResp.status})`);
  const data = await wfResp.json();
  const match = data.workflows?.find((w: any) => w.path.endsWith(`/${opts.workflow}`));
  if (!match) throw new Error(`Workflow ${opts.workflow} not found on default branch.`);
}
```

## Documentation Updates
- Add section *Workflow Dispatch Permissions* to: `CI-CD-SETUP.md`.
- Reference GitHub docs (official) & required scopes matrix.
- Include sample failure & resolution steps.

## Risks / Mitigations
| Risk | Mitigation |
|------|------------|
| Over‑privileged PAT used long term | Rotate to GitHub App or short‑lived PAT; restrict scopes |
| Hidden SSO enforcement | Re-authorize token after creation |
| Future token regression | Add CI check running a dry-run dispatch HEAD/OPTIONS |

## References
- REST Docs: https://docs.github.com/rest/actions/workflows#create-a-workflow-dispatch-event
- Token scopes: https://docs.github.com/authentication/keeping-your-account-and-data-secure/managing-personal-access-tokens
- Fine-grained guidance: https://docs.github.com/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token

## Ready for Copilot Agent
Agent Mode Recommendation: `refine-issue` then `implementation-plan` followed by `software-engineer-agent-v1`.

### Agent Tasks
- Validate scopes & repo settings.
- Implement permission pre-check utility.
- Update docs & retry dispatch.

---
<!-- Provide additional notes for assignees below if needed -->
