import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, Play } from "@phosphor-icons/react";
import type { ScanRequest } from "@/types/dashboard";
import { formatDistanceToNow, format } from "date-fns";

interface AuditTrailProps {
  scanRequests: ScanRequest[];
}

export function AuditTrail({ scanRequests }: AuditTrailProps) {
  const getStatusIcon = (status: ScanRequest['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className="text-green-600" weight="fill" />;
      case 'failed':
        return <XCircle size={16} className="text-red-600" weight="fill" />;
      case 'running':
        return <Play size={16} className="text-blue-600" weight="fill" />;
      default:
        return <Clock size={16} className="text-gray-600" weight="fill" />;
    }
  };

  const getStatusBadge = (status: ScanRequest['status']) => {
    const configs = {
      dispatched: { label: 'Dispatched', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      running: { label: 'Running', className: 'bg-blue-100 text-blue-800 border-blue-200' },
      completed: { label: 'Completed', className: 'bg-green-100 text-green-800 border-green-200' },
      failed: { label: 'Failed', className: 'bg-red-100 text-red-800 border-red-200' }
    };

    const config = configs[status];
    return (
      <Badge className={`font-medium ${config.className}`}>
        {config.label}
      </Badge>
    );
  };

  const getDuration = (request: ScanRequest) => {
    if (request.duration) {
      return `${Math.round(request.duration / 60)}m ${request.duration % 60}s`;
    }
    return 'N/A';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Audit Trail</CardTitle>
        <p className="text-sm text-muted-foreground">
          Complete history of all scan requests for FedRAMP compliance
        </p>
      </CardHeader>
      <CardContent>
        {scanRequests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No scan requests recorded yet
          </div>
        ) : (
          <div className="space-y-4">
            {scanRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(request.status)}
                  <div>
                    <p className="font-medium">{request.repository}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(request.timestamp), 'MMM dd, yyyy HH:mm:ss')} 
                      {' • '}
                      {formatDistanceToNow(new Date(request.timestamp))} ago
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-right text-sm">
                    <p className="text-muted-foreground">Duration</p>
                    <p className="font-medium">{getDuration(request)}</p>
                  </div>
                  
                  {request.findings && (
                    <div className="text-right text-sm">
                      <p className="text-muted-foreground">Findings</p>
                      <p className="font-medium">{request.findings.total}</p>
                    </div>
                  )}
                  
                  {getStatusBadge(request.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}