import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowSquareOut, Clock, Shield, Activity } from '@phosphor-icons/react';
import { createGitHubService } from '@/lib/github-service';
import type { Repository, WorkflowRun, SecurityFindings, SarifAnalysis } from '@/types/dashboard';
import React from 'react';

// Utility function to generate SVG path for trend line
function generateTrendLinePath(values: number[], max: number): string {
  return values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * 100;
    const y = 30 - (v / max) * 30;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

// Lightweight inline trend line component (no extra lib)
function TrendLine({ data }: { data: SarifAnalysis[] }) {
  const points = data.slice(-12); // limit
  const values = points.map(p => p.results_count);
  const max = Math.max(1, ...values);
  const path = generateTrendLinePath(values, max);
  return (
    <svg viewBox="0 0 100 30" className="w-full h-20">
      <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {values.map((v,i)=>{
        const x = (i/(Math.max(1, values.length-1)))*100;
        const y = 30 - (v/max)*30;
        return <circle key={i} cx={x} cy={y} r={1.8} fill="hsl(var(--primary))" />;
      })}
    </svg>
  );
}

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
  const [analysis, setAnalysis] = useState<SarifAnalysis | null>(null);
  const [historical, setHistorical] = useState<SarifAnalysis[]>([]);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [sarifDownloading, setSarifDownloading] = useState(false);
  const [sarifError, setSarifError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!repository || !token || !organization || !open) return;
      setLoading(true);
      setError(null);
      try {
        const svc = createGitHubService(token, organization);
        const [runsResp, findingsResp, analysisMeta, historyResp] = await Promise.all([
          svc.getWorkflowRuns(repository.name, 'codeql', 1, 10),
          svc.getSecurityFindings(repository.name),
          svc.analyzeRepositorySetup(repository.name),
          svc.getHistoricalAnalyses(repository.name, 30)
        ]);
        if (!cancelled) {
          setRuns(runsResp);
          setFindings(findingsResp);
          setAnalysis(analysisMeta.latestAnalysis || null);
          setHistorical(historyResp);
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

  const refreshAnalysis = async () => {
    if (!repository || !token || !organization) return;
    setAnalysisLoading(true);
    setSarifError(null);
    try {
      const svc = createGitHubService(token, organization);
      const meta = await svc.analyzeRepositorySetup(repository.name);
      const hist = await svc.getHistoricalAnalyses(repository.name, 30);
      setAnalysis(meta.latestAnalysis || null);
      setHistorical(hist);
    } catch (e) {
      setSarifError(e instanceof Error ? e.message : 'Failed to refresh analysis');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const downloadSarif = async () => {
    if (!repository || !token || !organization || !analysis) return;
    setSarifDownloading(true);
    setSarifError(null);
    try {
      const svc = createGitHubService(token, organization);
      const sarif = await svc.getSarifData(repository.name, analysis.id);
      const blob = new Blob([JSON.stringify(sarif, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${repository.name}-codeql-${analysis.id}.sarif.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setSarifError(e instanceof Error ? e.message : 'Failed to download SARIF');
    } finally {
      setSarifDownloading(false);
    }
  };

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

            <Card>
              <CardHeader className="pb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <CardTitle className="text-sm">Latest CodeQL Analysis</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={refreshAnalysis} disabled={analysisLoading}>
                    {analysisLoading ? 'Refreshing…' : 'Refresh'}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={downloadSarif} disabled={!analysis || sarifDownloading}>
                    {sarifDownloading ? 'Preparing…' : 'Download SARIF'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-3">
                {sarifError && <p className="text-red-600 text-xs">{sarifError}</p>}
                {!analysis && !analysisLoading && <p className="text-muted-foreground">No analysis detected in the last 30 days.</p>}
                {analysisLoading && <p className="text-muted-foreground animate-pulse">Loading analysis…</p>}
                {analysis && !analysisLoading && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Analysis ID</p>
                      <p className="font-mono text-xs truncate">{analysis.id}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Results</p>
                      <p className="font-semibold">{analysis.results_count}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Rules</p>
                      <p className="font-semibold">{analysis.rules_count}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Commit</p>
                      <p className="font-mono text-xs truncate">{analysis.commit_sha.slice(0,7)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Ref</p>
                      <p className="font-mono text-xs truncate">{analysis.ref.replace('refs/heads/','')}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Date</p>
                      <p>{new Date(analysis.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                )}
                {historical.length > 1 && (
                  <div>
                    <p className="text-xs uppercase text-muted-foreground mb-1">Result Trend (last {historical.length})</p>
                    <TrendLine data={historical} />
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
