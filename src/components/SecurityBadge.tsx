import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SecurityFindings } from "@/types/dashboard";

interface SecurityBadgeProps {
  findings: SecurityFindings;
  variant?: 'default' | 'compact';
}

export function SecurityBadge({ findings, variant = 'default' }: SecurityBadgeProps) {
  const getTotalSeverityLevel = (): 'critical' | 'high' | 'medium' | 'low' | 'clean' => {
    if (findings.critical > 0) return 'critical';
    if (findings.high > 0) return 'high';
    if (findings.medium > 0) return 'medium';
    if (findings.low > 0 || findings.note > 0) return 'low';
    return 'clean';
  };

  const severityLevel = getTotalSeverityLevel();
  
  const colorMap = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-blue-100 text-blue-800 border-blue-200',
    clean: 'bg-green-100 text-green-800 border-green-200'
  };

  const labelMap = {
    critical: 'Critical Risk',
    high: 'High Risk',
    medium: 'Medium Risk',
    low: 'Low Risk',
    clean: 'Clean'
  };

  if (variant === 'compact') {
    return (
      <Badge className={cn('font-medium', colorMap[severityLevel])}>
        {findings.total} {findings.total === 1 ? 'Finding' : 'Findings'}
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge className={cn('font-medium', colorMap[severityLevel])}>
        {labelMap[severityLevel]}
      </Badge>
      {findings.total > 0 && (
        <div className="flex gap-1 text-sm text-muted-foreground">
          {findings.critical > 0 && <span className="text-red-600">{findings.critical}C</span>}
          {findings.high > 0 && <span className="text-orange-600">{findings.high}H</span>}
          {findings.medium > 0 && <span className="text-yellow-600">{findings.medium}M</span>}
          {findings.low > 0 && <span className="text-blue-600">{findings.low}L</span>}
          {findings.note > 0 && <span className="text-gray-600">{findings.note}N</span>}
        </div>
      )}
    </div>
  );
}