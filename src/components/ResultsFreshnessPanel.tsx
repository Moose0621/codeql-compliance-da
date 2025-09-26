import { useMemo } from 'react';
import type { Repository, FreshnessSummary } from '@/types/dashboard';
import { computeFreshnessSummary } from '@/lib/sarif-utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface ResultsFreshnessPanelProps {
  repositories: Repository[];
}

export function ResultsFreshnessPanel({ repositories }: ResultsFreshnessPanelProps) {
  const summary: FreshnessSummary = useMemo(() => computeFreshnessSummary(repositories), [repositories]);
  const { buckets } = summary;
  const gaugeColor = summary.freshnessScore >= 85 ? 'bg-green-600' : summary.freshnessScore >= 60 ? 'bg-amber-500' : 'bg-red-600';
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Scan Freshness</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2 text-sm">
            <span>Freshness Score</span>
            <span className="font-mono">{summary.freshnessScore}%</span>
          </div>
          <div className="h-2 w-full rounded bg-muted overflow-hidden">
            <div className={`h-full ${gaugeColor}`} style={{ width: `${summary.freshnessScore}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="p-2 rounded border bg-background/50">
            <p className="uppercase tracking-wide text-muted-foreground">&lt; 24h</p>
            <p className="text-lg font-semibold">{buckets.fresh24h}</p>
          </div>
          <div className="p-2 rounded border bg-background/50">
            <p className="uppercase tracking-wide text-muted-foreground">1-7d</p>
            <p className="text-lg font-semibold">{buckets.stale7d}</p>
          </div>
            <div className="p-2 rounded border bg-background/50">
            <p className="uppercase tracking-wide text-muted-foreground">&gt; 7d</p>
            <p className="text-lg font-semibold">{buckets.old}</p>
          </div>
          <div className="p-2 rounded border bg-background/50">
            <p className="uppercase tracking-wide text-muted-foreground">Never</p>
            <p className="text-lg font-semibold">{buckets.never}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Score weights: &lt;24h=100, 1-7d=60, &gt;7d=20, Never=0 (normalized).</p>
      </CardContent>
    </Card>
  );
}
