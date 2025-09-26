import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { FileText, Table, Code, Clock } from "@phosphor-icons/react";
import type { ExportFormat } from "@/types/dashboard";

interface ExportStatusProps {
  exportHistory: Array<{id: string, format: ExportFormat, timestamp: string}>;
}

export function ExportStatus({ exportHistory }: ExportStatusProps) {
  const recentExports = exportHistory?.slice(0, 3) || [];
  
  if (recentExports.length === 0) {
    return null;
  }

  const getFormatIcon = (format: ExportFormat) => {
    switch (format) {
      case 'pdf': return <FileText size={12} />;
      case 'csv': return <Table size={12} />;
      case 'json': return <Code size={12} />;
      default: return <FileText size={12} />;
    }
  };

  const getRelativeTime = (timestamp: string) => {
    const now = new Date();
    const exportTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - exportTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="flex items-center gap-2 px-3"
          aria-label={`View ${recentExports.length} recent export${recentExports.length !== 1 ? 's' : ''}`}
        >
          <Clock size={14} className="text-muted-foreground" aria-hidden="true" />
          <Badge variant="secondary" className="text-xs px-2">
            {recentExports.length} recent export{recentExports.length !== 1 ? 's' : ''}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="font-medium text-sm">Recent Exports</div>
          <div className="space-y-2">
            {recentExports.map((exportItem, index) => (
              <Card key={index} className="border-muted">
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="p-1.5 bg-primary/10 rounded" aria-hidden="true">
                    {getFormatIcon(exportItem.format)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {exportItem.format.toUpperCase()} Report
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="sr-only">Exported </span>
                      {getRelativeTime(exportItem.timestamp)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}