import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { X, MagnifyingGlass } from '@phosphor-icons/react';
import type { Notification } from '@/types/dashboard';

interface NotificationFiltersProps {
  filters: {
    severity: string[];
    repository: string;
    dateRange: number;
  };
  onFiltersChange: (filters: {
    severity: string[];
    repository: string;
    dateRange: number;
  }) => void;
  notifications: Notification[];
}

export function NotificationFilters({ 
  filters, 
  onFiltersChange, 
  notifications 
}: NotificationFiltersProps) {
  const [tempRepository, setTempRepository] = useState(filters.repository);

  // Get unique repositories from notifications for suggestions
  const repositories = useMemo(() => {
    const repoSet = new Set<string>();
    notifications.forEach(n => {
      if (n.repository) repoSet.add(n.repository);
    });
    return Array.from(repoSet).sort();
  }, [notifications]);

  const severityOptions = [
    { value: 'critical', label: 'Critical', color: 'bg-red-600' },
    { value: 'high', label: 'High', color: 'bg-orange-500' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
    { value: 'low', label: 'Low', color: 'bg-blue-500' },
    { value: 'info', label: 'Info', color: 'bg-gray-500' }
  ];

  const dateRangeOptions = [
    { value: 0, label: 'All time' },
    { value: 1, label: 'Last 24 hours' },
    { value: 7, label: 'Last 7 days' },
    { value: 30, label: 'Last 30 days' },
    { value: 90, label: 'Last 3 months' }
  ];

  const handleSeverityToggle = (severity: string, checked: boolean) => {
    const newSeverities = checked
      ? [...filters.severity, severity]
      : filters.severity.filter(s => s !== severity);
    
    onFiltersChange({
      ...filters,
      severity: newSeverities
    });
  };

  const handleRepositoryChange = (repository: string) => {
    setTempRepository(repository);
    onFiltersChange({
      ...filters,
      repository
    });
  };

  const handleDateRangeChange = (dateRange: string) => {
    onFiltersChange({
      ...filters,
      dateRange: parseInt(dateRange, 10)
    });
  };

  const clearFilters = () => {
    setTempRepository('');
    onFiltersChange({
      severity: [],
      repository: '',
      dateRange: 0
    });
  };

  const hasActiveFilters = filters.severity.length > 0 || 
                          filters.repository || 
                          filters.dateRange > 0;

  return (
    <div className="notification-filters space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">Filter Notifications</h4>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-xs h-6"
          >
            <X size={12} />
            Clear
          </Button>
        )}
      </div>

      {/* Severity Filter */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Severity</Label>
        <div className="flex flex-wrap gap-2">
          {severityOptions.map(({ value, label, color }) => (
            <div key={value} className="flex items-center space-x-1">
              <Checkbox
                id={`severity-${value}`}
                checked={filters.severity.includes(value)}
                onCheckedChange={(checked) => handleSeverityToggle(value, !!checked)}
              />
              <label 
                htmlFor={`severity-${value}`}
                className="text-xs cursor-pointer flex items-center gap-1"
              >
                <div className={`w-2 h-2 rounded-full ${color}`} />
                {label}
              </label>
            </div>
          ))}
        </div>
        {filters.severity.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {filters.severity.map(severity => (
              <Badge 
                key={severity} 
                variant="secondary" 
                className="text-xs h-5 px-2"
              >
                {severity}
                <button
                  onClick={() => handleSeverityToggle(severity, false)}
                  className="ml-1 hover:bg-background rounded-full p-0.5"
                >
                  <X size={10} />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Repository Filter */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Repository</Label>
        <div className="space-y-2">
          <div className="relative">
            <MagnifyingGlass size={14} className="absolute left-2 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search repositories..."
              value={tempRepository}
              onChange={(e) => handleRepositoryChange(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          {repositories.length > 0 && (
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
              {repositories
                .filter(repo => 
                  !tempRepository || 
                  repo.toLowerCase().includes(tempRepository.toLowerCase())
                )
                .slice(0, 10)
                .map(repo => (
                  <Button
                    key={repo}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRepositoryChange(repo)}
                    className="h-6 text-xs px-2 font-mono"
                  >
                    {repo}
                  </Button>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Time Range</Label>
        <Select 
          value={filters.dateRange.toString()} 
          onValueChange={handleDateRangeChange}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            {dateRangeOptions.map(({ value, label }) => (
              <SelectItem key={value} value={value.toString()}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            Active filters: 
            {filters.severity.length > 0 && ` ${filters.severity.length} severity`}
            {filters.repository && ` repository: ${filters.repository}`}
            {filters.dateRange > 0 && ` ${dateRangeOptions.find(d => d.value === filters.dateRange)?.label.toLowerCase()}`}
          </div>
        </div>
      )}
    </div>
  );
}