import type { Repository, SarifData, FreshnessSummary, FreshnessBuckets } from '@/types/dashboard';

// Basic SARIF structural validation (lightweight – not full spec)
export function validateSarif(data: unknown): data is SarifData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Partial<SarifData> & { [k: string]: unknown };
  if (d.version !== '2.1.0') return false;
  if (!Array.isArray(d.runs)) return false;
  return d.runs.every(run => Boolean(run?.tool?.driver?.name));
}

// Compute freshness summary from repositories (uses last_scan_date)
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
export function computeFreshnessSummary(repositories: Repository[]): FreshnessSummary {
  const now = Date.now();
  const buckets: FreshnessBuckets = { fresh24h: 0, stale7d: 0, old: 0, never: 0 };
  repositories.forEach(r => {
    if (!r.last_scan_date) { buckets.never++; return; }
    const ageHrs = (now - new Date(r.last_scan_date).getTime()) / MILLISECONDS_PER_HOUR;
    if (ageHrs <= 24) buckets.fresh24h++;
    else if (ageHrs <= 24*7) buckets.stale7d++;
    else buckets.old++;
  });

  // Weight: fresh=1.0, stale=0.6, old=0.2, never=0
  const total = repositories.length || 1;
  const score = ((buckets.fresh24h*1) + (buckets.stale7d*0.6) + (buckets.old*0.2)) / total * 100;
  return {
    total: repositories.length,
    buckets,
    freshnessScore: Math.round(score),
    generated_at: new Date().toISOString()
  };
}

// Aggregate multiple SARIF payloads into a single JSON structure
export interface AggregatedSarifPayload {
  schemaVersion: 1;
  generated_at: string;
  repositories: Array<{
    repository: string; // full name
    analysis_id: number;
    commit_sha: string;
    sarif: SarifData | { error: string };
  }>;
}

export function buildAggregatedSarifPayload(entries: AggregatedSarifPayload['repositories']): AggregatedSarifPayload {
  return {
    schemaVersion: 1,
    generated_at: new Date().toISOString(),
    repositories: entries
  };
}
