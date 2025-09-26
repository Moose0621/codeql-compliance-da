import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';
import { 
  MagnifyingGlass, 
  FunnelSimple, 
  X, 
  ArrowClockwise,
  Shield,
  Clock,
  Tag,
  Code,
  Share
} from '@phosphor-icons/react';
import type { FilterState, FilterOptions } from '@/types/dashboard';

interface AdvancedFiltersProps {
  filterState: FilterState;
  availableOptions: FilterOptions;
  onFilterChange: (updates: Partial<FilterState>) => void;
  onClearFilters: () => void;
  resultsCount: number;
  totalCount: number;
  onGetShareableURL?: () => string;
}

export function AdvancedFilters({
  filterState,
  availableOptions,
  onFilterChange,
  onClearFilters,
  resultsCount,
  totalCount,
  onGetShareableURL
}: AdvancedFiltersProps) {
  const { search, severityFilter, showResultsOnly, advanced } = filterState;

  // Handle search input changes
  const handleSearchChange = (value: string) => {
    onFilterChange({ search: value });
  };

  // Handle severity filter changes
  const handleSeverityChange = (value: string | null) => {
    onFilterChange({ severityFilter: value });
  };

  // Handle results-only toggle
  const handleResultsOnlyToggle = (enabled: boolean) => {
    onFilterChange({ showResultsOnly: enabled });
  };

  // Handle advanced filter changes
  const updateAdvancedFilter = (key: keyof FilterOptions, value: any) => {
    onFilterChange({ 
      advanced: { ...advanced, [key]: value }
    });
  };

  // Handle share button
  const handleShare = async () => {
    if (!onGetShareableURL) return;
    
    const url = onGetShareableURL();
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        // Show success toast - you may want to add a toast system
        console.log('Filter URL copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy URL:', err);
        // Fallback to manual copy
        window.prompt('Copy this URL to share your filters:', url);
      }
    } else {
      // Fallback for browsers without clipboard API
      window.prompt('Copy this URL to share your filters:', url);
    }
  };

  // Check if any filters are active
  const hasActiveFilters = !!(
    search.trim() ||
    severityFilter ||
    Object.keys(advanced).some(key => {
      const value = advanced[key as keyof FilterOptions];
      return Array.isArray(value) ? value.length > 0 : value !== undefined;
    })
  );

  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FunnelSimple size={20} />
            Advanced Filters
          </CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              Showing {resultsCount} of {totalCount}
            </span>
            {onGetShareableURL && hasActiveFilters && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleShare}
                className="h-8 px-3"
              >
                <Share size={14} className="mr-1" />
                Share Filters
              </Button>
            )}
            {hasActiveFilters && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onClearFilters}
                className="h-8 px-3"
              >
                <X size={14} className="mr-1" />
                Clear All
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Search Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Search Repositories</label>
          <div className="relative">
            <MagnifyingGlass 
              size={16} 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" 
            />
            <Input
              placeholder="Search by name, description, or use operators: typescript AND security, NOT archived"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          {search.trim() && (
            <p className="text-xs text-muted-foreground">
              Supports boolean operators: AND, OR, NOT. Field searches: language:typescript, topic:security, status:needs-attention
            </p>
          )}
        </div>

        <Separator />

        {/* Quick Filters Row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Quick Filters:</span>
            <Toggle
              pressed={showResultsOnly}
              onPressedChange={handleResultsOnlyToggle}
              aria-label="Show only repositories with security findings"
              size="sm"
            >
              <Shield size={14} className="mr-1" />
              With Findings
            </Toggle>
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm">Severity:</span>
            {['critical', 'high', 'medium', 'low', 'note', 'none'].map((severity) => (
              <Badge
                key={severity}
                variant={severityFilter === severity ? "default" : "outline"}
                className="cursor-pointer select-none text-xs"
                onClick={() => handleSeverityChange(severityFilter === severity ? null : severity)}
              >
                {severity}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        {/* Advanced Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Languages Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1">
              <Code size={14} />
              Languages
            </label>
            <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-2">
              {availableOptions.languages.slice(0, 20).map((language) => {
                const isSelected = advanced.languages?.includes(language) || false;
                return (
                  <div
                    key={language}
                    className={`cursor-pointer px-2 py-1 rounded text-sm transition-colors ${
                      isSelected 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => {
                      const currentLanguages = advanced.languages || [];
                      const newLanguages = isSelected
                        ? currentLanguages.filter(l => l !== language)
                        : [...currentLanguages, language];
                      updateAdvancedFilter('languages', newLanguages);
                    }}
                  >
                    {language}
                  </div>
                );
              })}
              {availableOptions.languages.length === 0 && (
                <p className="text-xs text-muted-foreground p-2">No languages found</p>
              )}
            </div>
            {advanced.languages && advanced.languages.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {advanced.languages.length} selected
              </p>
            )}
          </div>

          {/* Topics Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1">
              <Tag size={14} />
              Topics
            </label>
            <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-2">
              {availableOptions.topics.slice(0, 20).map((topic) => {
                const isSelected = advanced.topics?.includes(topic) || false;
                return (
                  <div
                    key={topic}
                    className={`cursor-pointer px-2 py-1 rounded text-sm transition-colors ${
                      isSelected 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => {
                      const currentTopics = advanced.topics || [];
                      const newTopics = isSelected
                        ? currentTopics.filter(t => t !== topic)
                        : [...currentTopics, topic];
                      updateAdvancedFilter('topics', newTopics);
                    }}
                  >
                    {topic}
                  </div>
                );
              })}
              {availableOptions.topics.length === 0 && (
                <p className="text-xs text-muted-foreground p-2">No topics found</p>
              )}
            </div>
            {advanced.topics && advanced.topics.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {advanced.topics.length} selected
              </p>
            )}
          </div>

          {/* Activity Period */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1">
              <Clock size={14} />
              Activity Period
            </label>
            <Select
              value={advanced.activityPeriod || 'all'}
              onValueChange={(value) => updateAdvancedFilter('activityPeriod', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any time</SelectItem>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="3m">Last 3 months</SelectItem>
                <SelectItem value="6m">Last 6 months</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Last Scan Age */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1">
              <ArrowClockwise size={14} />
              Last Scan Age
            </label>
            <Select
              value={advanced.lastScanAge || 'any'}
              onValueChange={(value) => updateAdvancedFilter('lastScanAge', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any age" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any age</SelectItem>
                <SelectItem value="1d">Within 1 day</SelectItem>
                <SelectItem value="7d">Within 7 days</SelectItem>
                <SelectItem value="30d">Within 30 days</SelectItem>
                <SelectItem value="90d">Within 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Compliance Score Range */}
          <div className="space-y-3 md:col-span-2">
            <label className="text-sm font-medium flex items-center gap-1">
              <Shield size={14} />
              Compliance Score Range
            </label>
            <div className="px-3">
              <Slider
                value={advanced.complianceScoreRange || [0, 100]}
                onValueChange={(value) => updateAdvancedFilter('complianceScoreRange', value as [number, number])}
                max={100}
                min={0}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{advanced.complianceScoreRange?.[0] || 0}</span>
                <span>{advanced.complianceScoreRange?.[1] || 100}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Active Filters</h4>
              <div className="flex flex-wrap gap-2">
                {search.trim() && (
                  <Badge variant="secondary" className="text-xs">
                    Search: "{search}"
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-auto p-0 ml-1"
                      onClick={() => handleSearchChange('')}
                    >
                      <X size={12} />
                    </Button>
                  </Badge>
                )}
                
                {severityFilter && (
                  <Badge variant="secondary" className="text-xs">
                    Severity: {severityFilter}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-auto p-0 ml-1"
                      onClick={() => handleSeverityChange(null)}
                    >
                      <X size={12} />
                    </Button>
                  </Badge>
                )}
                
                {showResultsOnly && (
                  <Badge variant="secondary" className="text-xs">
                    With Findings Only
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-auto p-0 ml-1"
                      onClick={() => handleResultsOnlyToggle(false)}
                    >
                      <X size={12} />
                    </Button>
                  </Badge>
                )}
                
                {advanced.languages && advanced.languages.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    Languages: {advanced.languages.length}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-auto p-0 ml-1"
                      onClick={() => updateAdvancedFilter('languages', [])}
                    >
                      <X size={12} />
                    </Button>
                  </Badge>
                )}
                
                {advanced.topics && advanced.topics.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    Topics: {advanced.topics.length}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-auto p-0 ml-1"
                      onClick={() => updateAdvancedFilter('topics', [])}
                    >
                      <X size={12} />
                    </Button>
                  </Badge>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}