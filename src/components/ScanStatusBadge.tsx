import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle, Clock, XCircle, Warning } from "@phosphor-icons/react";

interface ScanStatusBadgeProps {
  status: 'success' | 'failure' | 'in_progress' | 'pending';
  className?: string;
}

export function ScanStatusBadge({ status, className }: ScanStatusBadgeProps) {
  const statusConfig = {
    success: {
      icon: CheckCircle,
      label: 'Success',
      className: 'bg-green-100 text-green-800 border-green-200'
    },
    failure: {
      icon: XCircle,
      label: 'Failed',
      className: 'bg-red-100 text-red-800 border-red-200'
    },
    in_progress: {
      icon: Clock,
      label: 'Running',
      className: 'bg-blue-100 text-blue-800 border-blue-200'
    },
    pending: {
      icon: Warning,
      label: 'Pending',
      className: 'bg-gray-100 text-gray-800 border-gray-200'
    }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge className={cn('font-medium flex items-center gap-1', config.className, className)}>
      <Icon size={12} weight="fill" />
      {config.label}
    </Badge>
  );
}