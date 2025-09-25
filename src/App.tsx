import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Toaster } from "@/components/ui/sonner";
import { RepositoryCard } from "@/components/RepositoryCard";
import { SecurityChart } from "@/components/SecurityChart";
import { AuditTrail } from "@/components/AuditTrail";
import { ExportDialog } from "@/components/ExportDialog";
import { QuickExport } from "@/components/QuickExport";
import { ExportStatus } from "@/components/ExportStatus";
import { Shield, ArrowClockwise, Activity, FileText, Warning, Table, Code } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useKV } from '@github/spark/hooks';
import type { Repository, ScanRequest, ExportFormat, ComplianceReport } from "@/types/dashboard";

// Mock data for demo purposes
const mockRepositories: Repository[] = [
  {
    id: 1,
    name: "security-scanner",
    full_name: "octodemo/security-scanner",
    owner: {
      login: "octodemo",
      avatar_url: "https://github.com/octodemo.png"
    },
    has_codeql_workflow: true,
    workflow_dispatch_enabled: true,
    default_branch: "main",
    last_scan_date: "2024-01-15T10:30:00Z",
    last_scan_status: "success",
    security_findings: {
      critical: 2,
      high: 5,
      medium: 12,
      low: 8,
      note: 3,
      total: 30
    }
  },
  {
    id: 2,
    name: "api-gateway",
    full_name: "octodemo/api-gateway",
    owner: {
      login: "octodemo",
      avatar_url: "https://github.com/octodemo.png"
    },
    has_codeql_workflow: true,
    workflow_dispatch_enabled: true,
    default_branch: "main",
    last_scan_date: "2024-01-14T15:45:00Z",
    last_scan_status: "failure",
    security_findings: {
      critical: 0,
      high: 2,
      medium: 4,
      low: 6,
      note: 1,
      total: 13
    }
  },
  {
    id: 3,
    name: "web-frontend",
    full_name: "octodemo/web-frontend",
    owner: {
      login: "octodemo",
      avatar_url: "https://github.com/octodemo.png"
    },
    has_codeql_workflow: true,
    workflow_dispatch_enabled: true,
    default_branch: "main",
    last_scan_date: undefined,
    last_scan_status: "pending",
    security_findings: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      note: 0,
      total: 0
    }
  }
];

function App() {
  const [repositories, setRepositories] = useState<Repository[]>(mockRepositories);
  const [scanRequests, setScanRequests] = useKV<ScanRequest[]>("scan-requests", []);
  const [exportHistory, setExportHistory] = useKV<Array<{id: string, format: ExportFormat, timestamp: string}>>("export-history", []);
  const [isLoading, setIsLoading] = useState(false);
  const [scanningRepos, setScanningRepos] = useState<Set<number>>(new Set());

  const handleRefreshRepositories = async () => {
    setIsLoading(true);
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success("Repository list refreshed");
    } catch (error) {
      toast.error("Failed to refresh repositories");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDispatchScan = async (repository: Repository) => {
    setScanningRepos(prev => new Set(prev).add(repository.id));
    
    const scanRequest: ScanRequest = {
      id: `scan-${Date.now()}`,
      repository: repository.full_name,
      timestamp: new Date().toISOString(),
      status: 'dispatched'
    };

    try {
      // Add to audit trail immediately
      setScanRequests(prev => [scanRequest, ...(prev || [])]);
      
      // Simulate workflow dispatch
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update request status to running
      const runningRequest: ScanRequest = {
        ...scanRequest,
        status: 'running'
      };
      
      setScanRequests(prev => (prev || []).map(req => 
        req.id === scanRequest.id ? runningRequest : req
      ));

      // Update repository status
      setRepositories(prev => prev.map(repo =>
        repo.id === repository.id 
          ? { ...repo, last_scan_status: 'in_progress' as const }
          : repo
      ));

      toast.success(`CodeQL scan dispatched for ${repository.name}`);

      // Simulate scan completion after 2-3 minutes (shortened for demo)
      setTimeout(async () => {
        const completedRequest: ScanRequest = {
          ...runningRequest,
          status: 'completed',
          duration: 150, // 2.5 minutes
          findings: {
            critical: Math.floor(Math.random() * 3),
            high: Math.floor(Math.random() * 8),
            medium: Math.floor(Math.random() * 15),
            low: Math.floor(Math.random() * 10),
            note: Math.floor(Math.random() * 5),
            total: 0
          }
        };
        completedRequest.findings!.total = Object.values(completedRequest.findings!).slice(0, -1).reduce((a, b) => a + b, 0);

        setScanRequests(prev => (prev || []).map(req => 
          req.id === scanRequest.id ? completedRequest : req
        ));

        setRepositories(prev => prev.map(repo =>
          repo.id === repository.id 
            ? { 
                ...repo, 
                last_scan_status: 'success' as const,
                last_scan_date: new Date().toISOString(),
                security_findings: completedRequest.findings
              }
            : repo
        ));

        setScanningRepos(prev => {
          const newSet = new Set(prev);
          newSet.delete(repository.id);
          return newSet;
        });

        toast.success(`CodeQL scan completed for ${repository.name}`);
      }, 5000); // 5 seconds for demo

    } catch (error) {
      toast.error(`Failed to dispatch scan for ${repository.name}`);
      setScanningRepos(prev => {
        const newSet = new Set(prev);
        newSet.delete(repository.id);
        return newSet;
      });
    }
  };

  const handleViewDetails = (repository: Repository) => {
    toast.info(`Viewing details for ${repository.name}`);
  };

  const handleExportReport = (format: ExportFormat, report: ComplianceReport) => {
    const exportEntry = {
      id: report.id,
      format,
      timestamp: new Date().toISOString()
    };
    
    setExportHistory(prev => [exportEntry, ...(prev || []).slice(0, 9)]); // Keep last 10 exports
    toast.success(`Compliance report exported as ${format.toUpperCase()}`);
  };

  const getOverallStats = () => {
    const totalRepos = repositories.length;
    const activeScans = repositories.filter(r => r.last_scan_status === 'in_progress').length;
    const totalFindings = repositories.reduce((acc, repo) => 
      acc + (repo.security_findings?.total || 0), 0
    );
    const criticalFindings = repositories.reduce((acc, repo) => 
      acc + (repo.security_findings?.critical || 0), 0
    );

    return { totalRepos, activeScans, totalFindings, criticalFindings };
  };

  const stats = getOverallStats();

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg">
              <Shield size={24} className="text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">CodeQL Security Dashboard</h1>
              <p className="text-muted-foreground">Enterprise FedRAMP Compliance Monitoring</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <ExportStatus exportHistory={exportHistory || []} />
            <QuickExport repositories={repositories} />
            <ExportDialog repositories={repositories} onExport={handleExportReport} />
            <Button
              onClick={handleRefreshRepositories}
              disabled={isLoading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowClockwise size={16} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Repositories</CardTitle>
              <FileText size={16} className="text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRepos}</div>
              <p className="text-xs text-muted-foreground">CodeQL enabled</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Scans</CardTitle>
              <Activity size={16} className="text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.activeScans}</div>
              <p className="text-xs text-muted-foreground">Currently running</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Findings</CardTitle>
              <Warning size={16} className="text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.totalFindings}</div>
              <p className="text-xs text-muted-foreground">Security issues</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
              <Shield size={16} className="text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.criticalFindings}</div>
              <p className="text-xs text-muted-foreground">Require immediate attention</p>
            </CardContent>
          </Card>
        </div>

        {/* Compliance Alert */}
        <Alert className="mb-8 border-accent/20 bg-accent/5">
          <Shield size={16} className="text-accent" />
          <AlertDescription className="text-accent-foreground">
            <strong>FedRAMP Compliance:</strong> All repositories listed have advanced CodeQL workflow dispatch enabled. 
            Scan requests complete within 2-3 minutes to meet audit requirements.
          </AlertDescription>
        </Alert>

        {/* Main Content Tabs */}
        <Tabs defaultValue="repositories" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="repositories">Repositories</TabsTrigger>
            <TabsTrigger value="analytics">Security Analytics</TabsTrigger>
            <TabsTrigger value="audit">Audit Trail</TabsTrigger>
            <TabsTrigger value="exports">Export History</TabsTrigger>
          </TabsList>

          <TabsContent value="repositories" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {repositories.map(repository => (
                <RepositoryCard
                  key={repository.id}
                  repository={repository}
                  onDispatchScan={handleDispatchScan}
                  onViewDetails={handleViewDetails}
                  isScanning={scanningRepos.has(repository.id)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <SecurityChart 
              findings={repositories.map(r => r.security_findings || {
                critical: 0, high: 0, medium: 0, low: 0, note: 0, total: 0
              })} 
            />
          </TabsContent>

          <TabsContent value="audit" className="space-y-6">
            <AuditTrail scanRequests={scanRequests || []} />
          </TabsContent>

          <TabsContent value="exports" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText size={20} />
                  Export History
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Recent compliance report exports and downloads
                </p>
              </CardHeader>
              <CardContent>
                {exportHistory && exportHistory.length > 0 ? (
                  <div className="space-y-3">
                    {exportHistory.map((export_item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded">
                            {export_item.format === 'pdf' && <FileText size={16} className="text-primary" />}
                            {export_item.format === 'csv' && <Table size={16} className="text-primary" />}
                            {export_item.format === 'json' && <Code size={16} className="text-primary" />}
                          </div>
                          <div>
                            <p className="font-medium">
                              {export_item.format.toUpperCase()} Compliance Report
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Exported {new Date(export_item.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">
                          {export_item.format.toUpperCase()}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No exports yet</p>
                    <p className="text-sm">Use the Export Report button to generate your first compliance report</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;