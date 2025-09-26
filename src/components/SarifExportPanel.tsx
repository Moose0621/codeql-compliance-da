import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Repository } from '@/types/dashboard';
import { buildAggregatedSarifPayload, validateSarif } from '@/lib/sarif-utils';
import { createGitHubService } from '@/lib/github-service';
import { toast } from 'sonner';

interface SarifExportPanelProps {
  repositories: Repository[];
  token?: string;
  organization?: string;
}

export function SarifExportPanel({ repositories, token, organization }: SarifExportPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [lastExportSize, setLastExportSize] = useState<number | null>(null);

  const handleExport = async () => {
    if (!token || !organization) {
      toast.error('GitHub connection required');
      return;
    }
    setIsExporting(true);
    try {
      const svc = createGitHubService(token, organization);
      const targets = repositories.slice(0, 50);
      const entries: Array<{ repository: string; analysis_id: number; commit_sha: string; sarif: import('@/types/dashboard').SarifData | { error: string } }> = [];
      const concurrency = 6;
      let index = 0;
      async function worker() {
        while (true) {
          const current = targets[index++];
          if (!current) break;
          try {
            const latest = await svc.getLatestAnalysis(current.name);
            if (!latest) { entries.push({ repository: current.full_name, analysis_id: -1, commit_sha: '', sarif: { error: 'no-analysis' } }); continue; }
            const sarifData = await svc.getSarifData(current.name, latest.id);
            const sarif = validateSarif(sarifData) ? sarifData : { error: 'invalid-sarif' };
            entries.push({ repository: current.full_name, analysis_id: latest.id, commit_sha: latest.commit_sha, sarif });
          } catch {
            entries.push({ repository: current.full_name, analysis_id: -1, commit_sha: '', sarif: { error: 'fetch-failed' } });
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, () => worker()));
      const payload = buildAggregatedSarifPayload(entries);
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      setLastExportSize(blob.size);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aggregated-sarif-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Aggregated SARIF exported');
  } catch {
      toast.error('Failed to export SARIF');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card aria-busy={isExporting}>
      <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <CardTitle className="text-lg font-semibold">Aggregated SARIF Export</CardTitle>
        <Button 
          size="sm" 
          onClick={handleExport} 
          disabled={isExporting || !token || !organization}
          aria-label={isExporting ? 'Export in progress' : 'Export SARIF data'}
        >
          {isExporting ? 'Exporting…' : 'Export SARIF'}
        </Button>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        <p>Build a single JSON artifact containing latest CodeQL SARIF (where available) per repository (max 50 for now).</p>
        {isExporting && (
          <p className="text-sm text-primary font-medium" aria-live="polite" role="status">
            Processing SARIF data from repositories...
          </p>
        )}
        {lastExportSize !== null && (
          <p className="text-xs text-muted-foreground">Last export size: {(lastExportSize/1024).toFixed(1)} KB</p>
        )}
        <p className="text-xs text-muted-foreground">Invalid or missing analyses are annotated with error markers for audit transparency.</p>
      </CardContent>
    </Card>
  );
}
