import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  Warning, 
  CheckCircle, 
  Clock, 
  Activity,
  GitBranch
} from '@phosphor-icons/react';
import type { FilterPreset, FilterState } from '@/types/dashboard';

interface FilterPresetsProps {
  onApplyPreset: (filters: Partial<FilterState>) => void;
}

// Define common filter presets for compliance scenarios
const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'compliance-ready',
    name: 'Compliance Ready',
    description: 'Repositories with recent scans, high compliance scores, and no critical issues',
    icon: 'CheckCircle',
    filters: {
      advanced: {
        complianceScoreRange: [80, 100],
        lastScanAge: '7d'
      },
      severityFilter: 'none'
    }
  },
  {
    id: 'needs-attention',
    name: 'Needs Attention',
    description: 'Repositories with critical/high findings or low compliance scores',
    icon: 'Warning',
    filters: {
      advanced: {
        complianceScoreRange: [0, 69]
      },
      showResultsOnly: true
    }
  },
  {
    id: 'critical-issues',
    name: 'Critical Issues',
    description: 'Repositories with critical security findings requiring immediate action',
    icon: 'Shield',
    filters: {
      severityFilter: 'critical',
      showResultsOnly: true
    }
  },
  {
    id: 'recently-active',
    name: 'Recently Active',
    description: 'Repositories with recent activity (last 7 days)',
    icon: 'Activity',
    filters: {
      advanced: {
        activityPeriod: '7d'
      }
    }
  },
  {
    id: 'stale-scans',
    name: 'Stale Scans',
    description: 'Repositories with outdated scans (>30 days) needing refresh',
    icon: 'Clock',
    filters: {
      search: 'NOT status:needs-attention',
      advanced: {
        lastScanAge: '90d'
      }
    }
  },
  {
    id: 'typescript-repos',
    name: 'TypeScript Repositories',
    description: 'All repositories primarily using TypeScript',
    icon: 'GitBranch',
    filters: {
      search: 'language:typescript'
    }
  },
  {
    id: 'security-focused',
    name: 'Security-Focused',
    description: 'Repositories tagged with security-related topics',
    icon: 'Shield',
    filters: {
      search: 'topic:security OR topic:vulnerability OR topic:authentication'
    }
  }
];

const getPresetIcon = (iconName: string) => {
  switch (iconName) {
    case 'CheckCircle':
      return <CheckCircle size={16} className="text-green-600" />;
    case 'Warning':
      return <Warning size={16} className="text-yellow-600" />;
    case 'Shield':
      return <Shield size={16} className="text-blue-600" />;
    case 'Activity':
      return <Activity size={16} className="text-purple-600" />;
    case 'Clock':
      return <Clock size={16} className="text-orange-600" />;
    case 'GitBranch':
      return <GitBranch size={16} className="text-indigo-600" />;
    default:
      return <Shield size={16} className="text-gray-600" />;
  }
};

export function FilterPresets({ onApplyPreset }: FilterPresetsProps) {
  const handleApplyPreset = (preset: FilterPreset) => {
    onApplyPreset(preset.filters);
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Filter Presets</CardTitle>
        <p className="text-sm text-muted-foreground">
          Quick access to common compliance and security filtering scenarios
        </p>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {FILTER_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              variant="outline"
              className="h-auto p-4 flex flex-col items-start gap-2 hover:bg-muted/50 transition-colors"
              onClick={() => handleApplyPreset(preset)}
            >
              <div className="flex items-center gap-2 w-full">
                {getPresetIcon(preset.icon || 'Shield')}
                <span className="font-medium text-sm truncate flex-1 text-left">
                  {preset.name}
                </span>
              </div>
              <p className="text-xs text-muted-foreground text-left leading-relaxed">
                {preset.description}
              </p>
              
              {/* Show preview of filters */}
              <div className="flex flex-wrap gap-1 mt-1 w-full">
                {preset.filters.severityFilter && (
                  <Badge variant="secondary" className="text-xs">
                    {preset.filters.severityFilter}
                  </Badge>
                )}
                {preset.filters.showResultsOnly && (
                  <Badge variant="secondary" className="text-xs">
                    With Findings
                  </Badge>
                )}
                {preset.filters.advanced?.complianceScoreRange && (
                  <Badge variant="secondary" className="text-xs">
                    Score: {preset.filters.advanced.complianceScoreRange[0]}-{preset.filters.advanced.complianceScoreRange[1]}
                  </Badge>
                )}
                {preset.filters.advanced?.activityPeriod && preset.filters.advanced.activityPeriod !== 'all' && (
                  <Badge variant="secondary" className="text-xs">
                    {preset.filters.advanced.activityPeriod}
                  </Badge>
                )}
                {preset.filters.advanced?.lastScanAge && preset.filters.advanced.lastScanAge !== 'any' && (
                  <Badge variant="secondary" className="text-xs">
                    Scans: {preset.filters.advanced.lastScanAge}
                  </Badge>
                )}
                {preset.filters.search && (
                  <Badge variant="secondary" className="text-xs">
                    Query
                  </Badge>
                )}
              </div>
            </Button>
          ))}
        </div>
        
        <div className="mt-4 p-3 bg-muted/30 rounded-md">
          <h4 className="text-sm font-medium mb-2">Preset Tips:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Click any preset to instantly apply those filters</li>
            <li>• Presets can be combined with additional manual filters</li>
            <li>• Use "Needs Attention" for compliance audit preparation</li>
            <li>• "Recently Active" helps focus on actively developed repositories</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}