import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SecurityBadge } from "@/components/SecurityBadge";
import { ScanStatusBadge } from "@/components/ScanStatusBadge";
import { Play, Eye, Clock } from "@phosphor-icons/react";
import type { Repository } from "@/types/dashboard";
import { formatDistanceToNow } from "date-fns";

interface RepositoryCardProps {
  repository: Repository;
  onDispatchScan: (repo: Repository) => void;
  onViewDetails: (repo: Repository) => void;
  onRefreshLatest?: (repo: Repository) => void; // for Default Setup refresh
  isScanning?: boolean;
  isRefreshing?: boolean;
  scanHistory?: Array<{ timestamp: string; findingsTotal?: number }>;
}

export function RepositoryCard({ 
  repository, 
  onDispatchScan, 
  onViewDetails, 
  onRefreshLatest,
  isScanning = false,
  isRefreshing = false,
  scanHistory = []
}: RepositoryCardProps) {
  const handlePrimaryAction = () => {
    if (repository.workflow_dispatch_enabled) {
      onDispatchScan(repository);
    } else if (onRefreshLatest) {
      onRefreshLatest(repository);
    }
  };

  const handleViewDetails = () => {
    onViewDetails(repository);
  };

  const getLastScanText = () => {
    if (!repository.last_scan_date) return 'Never scanned';
    return `${formatDistanceToNow(new Date(repository.last_scan_date))} ago`;
  };

  // Build sparkline path from scanHistory totals
  const sparkPoints = scanHistory.slice(-8).map(s => s.findingsTotal ?? 0);
  const maxVal = Math.max(1, ...sparkPoints);
  const sparkPath = sparkPoints.map((v,i)=>{
    const x = (i/(Math.max(1,sparkPoints.length-1)))*80;
    const y = 24 - (v/maxVal)*24;
    return `${i===0?'M':'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <Card className="transition-colors duration-300 hover:shadow-lg border-border group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={repository.owner.avatar_url} alt={repository.owner.login} />
              <AvatarFallback>{repository.owner.login[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg font-semibold">{repository.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{repository.full_name}</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            CodeQL Ready
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{getLastScanText()}</span>
          </div>
          <ScanStatusBadge status={repository.last_scan_status} />
        </div>

        {repository.security_findings && (
          <SecurityBadge findings={repository.security_findings} />
        )}

        {sparkPoints.length > 1 && (
          <div className="pt-1">
            <svg viewBox="0 0 80 24" width="80" height="24" className="overflow-visible">
              <path d={sparkPath} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            </svg>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Findings trend</p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            onClick={handlePrimaryAction}
            disabled={repository.workflow_dispatch_enabled ? (isScanning || repository.last_scan_status === 'in_progress') : isRefreshing}
            className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            <Play size={16} className="mr-2" />
            {repository.workflow_dispatch_enabled
              ? (isScanning || repository.last_scan_status === 'in_progress' ? 'Scanning...' : 'Request Scan')
              : (isRefreshing ? 'Refreshing...' : 'Refresh Results')}
          </Button>
          
          <Button
            variant="outline"
            onClick={handleViewDetails}
            className="flex-shrink-0 group-hover:border-primary"
          >
            <Eye size={16} className="mr-2" />
            Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}