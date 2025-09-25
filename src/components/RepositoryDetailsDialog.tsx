import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowSquareOut, Clock, Shield, Activity } from '@phosphor-icons/react';
import { createGitHubService } from '@/lib/github-service';
import type { Repository, WorkflowRun, SecurityFindings } from '@/types/dashboard';

interface RepositoryDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repository: Repository | null;
  token: string;
  organization: string;
}

export function RepositoryDetailsDialog({ open, onOpenChange, repository, token, organization }: RepositoryDetailsDialogProps) {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [findings, setFindings] = useState<SecurityFindings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!repository || !token || !organization || !open) return;
      setLoading(true);
      setError(null);
      try {
        const svc = createGitHubService(token, organization);
        const [runsResp, findingsResp] = await Promise.all([
          svc.getWorkflowRuns(repository.name, 'codeql', 1, 10),
          svc.getSecurityFindings(repository.name)
        ]);
        if (!cancelled) {
          setRuns(runsResp);
          setFindings(findingsResp);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [open, repository, token, organization]);

  if (!repository) return null;

  const severityBadges = findings ? [
    { label: 'Critical', value: findings.critical, color: 'bg-red-600/15 text-red-600' },
    { label: 'High', value: findings.high, color: 'bg-orange-600/15 text-orange-600' },
    { label: 'Medium', value: findings.medium, color: 'bg-amber-500/20 text-amber-600' },
    { label: 'Low', value: findings.low, color: 'bg-blue-600/15 text-blue-600' },
    { label: 'Note', value: findings.note, color: 'bg-muted text-muted-foreground' }
  ] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield size={20} className="text-primary" />
            Repository Details – {repository.name}
            <a href={`https://github.com/${repository.full_name}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-sm inline-flex items-center gap-1 underline text-muted-foreground hover:text-foreground">
              View on GitHub <ArrowSquareOut size={14} />
            </a>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {severityBadges.map(b => (
                <Badge key={b.label} className={b.color}>{b.label}: {b.value}</Badge>
              ))}
              {findings && (
                <Badge variant="outline">Total: {findings.total}</Badge>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Activity size={16} /> Recent CodeQL Runs</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading && (
                    <div className="space-y-2 animate-pulse">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-10 bg-muted rounded" />
                      ))}
                    </div>
                  )}
                  {!loading && error && (
                    <p className="text-sm text-red-600">{error}</p>
                  )}
                  {!loading && !error && runs.length === 0 && (
                    <p className="text-sm text-muted-foreground">No recent runs found.</p>
                  )}
                  {!loading && !error && runs.length > 0 && (
                    <ul className="space-y-2 text-sm">
                      {runs.map(r => (
                        <li key={r.id} className="p-2 rounded border flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-muted-foreground" />
                            <span>{new Date(r.updated_at).toLocaleString()}</span>
                          </div>
                          <Badge variant={r.conclusion === 'success' ? 'default' : r.conclusion === 'failure' ? 'destructive' : 'outline'}>
                            {r.conclusion || r.status || 'unknown'}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Metadata</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="flex justify-between"><span>Full Name</span><span className="font-mono">{repository.full_name}</span></div>
                  <div className="flex justify-between"><span>Default Branch</span><span>{repository.default_branch}</span></div>
                  <div className="flex justify-between"><span>CodeQL Workflow</span><span>{repository.has_codeql_workflow ? 'Detected' : 'Missing'}</span></div>
                  <div className="flex justify-between"><span>Last Scan Status</span><span>{repository.last_scan_status}</span></div>
                  <div className="flex justify-between"><span>Last Scan Date</span><span>{repository.last_scan_date ? new Date(repository.last_scan_date).toLocaleString() : '—'}</span></div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
