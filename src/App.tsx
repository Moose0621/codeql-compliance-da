import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Toaster } from "@/components/ui/sonner";
import { RepositoryCard } from "@/components/RepositoryCard";
import { SecurityChart } from "@/components/SecurityChart";
import { ResultsFreshnessPanel } from '@/components/ResultsFreshnessPanel';
import { SarifExportPanel } from '@/components/SarifExportPanel';
import { ReportGenerationPanel } from '@/components/ReportGenerationPanel';
import { AuditTrail } from "@/components/AuditTrail";
import { ExportDialog } from "@/components/ExportDialog";
import { QuickExport } from "@/components/QuickExport";
import { ExportStatus } from "@/components/ExportStatus";
import { GitHubConnection } from "@/components/GitHubConnection";
import { Shield, ArrowClockwise, Activity, FileText, Warning, Table, Code, GitBranch, CheckCircle, FunnelSimple, MagnifyingGlass } from "@phosphor-icons/react";
import { toast } from "sonner";
// Replaced Spark KV with localStorage persistence
import { usePersistentConfig } from '@/hooks/usePersistentConfig';
import { getEnvConfig } from '@/lib/env-config';
import { createGitHubService } from '@/lib/github-service';
import type { Repository, ScanRequest, ExportFormat, ComplianceReport } from "@/types/dashboard";
import { ThemeToggle } from '@/components/ThemeToggle';
import { RepositoryDetailsDialog } from '@/components/RepositoryDetailsDialog';
import { Input } from '@/components/ui/input';

interface GitHubConfig {
  token: string;
  organization: string;
  isConnected: boolean;
  lastVerified?: string;
  userInfo?: {
    login: string;
    name: string;
    avatar_url: string;
  };
}

function App() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const env = getEnvConfig();
  const envManaged = !!(env.token && env.org);
  const [githubConfig, setGithubConfig] = usePersistentConfig<GitHubConfig>("github-config", {
    token: env.token || "",
    organization: env.org || "",
    isConnected: envManaged,
    lastVerified: envManaged ? new Date().toISOString() : undefined
  });
  const [scanRequests, setScanRequests] = usePersistentConfig<ScanRequest[]>("scan-requests", []);
  const [exportHistory, setExportHistory] = usePersistentConfig<Array<{id: string, format: ExportFormat, timestamp: string}>>("export-history", []);
  const [isLoading, setIsLoading] = useState(false);
  const [scanningRepos, setScanningRepos] = useState<Set<number>>(new Set());
  const [refreshingRepos, setRefreshingRepos] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState("setup");
  const [detailsRepo, setDetailsRepo] = useState<Repository | null>(null);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 30;

  // Load repositories when GitHub connection is established or restored
  useEffect(() => {
    if (githubConfig?.isConnected && githubConfig?.token && githubConfig?.organization) {
      setActiveTab(prev => (prev === 'setup' ? 'repositories' : prev));
      if (repositories.length === 0) fetchRepositories();
    } else {
      setRepositories([]);
      if (!githubConfig?.isConnected) setActiveTab('setup');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [githubConfig?.isConnected, githubConfig?.token, githubConfig?.organization]);

  const fetchRepositories = async (showToast = true, append = false, pageParam = 1) => {
    if (!githubConfig?.token || !githubConfig?.organization) {
      if (showToast) {
        toast.error("GitHub connection required");
      }
      return;
    }

    setIsLoading(true);
    try {
      const githubService = createGitHubService(githubConfig.token, githubConfig.organization);
      const repos = await githubService.getOrganizationRepositories(pageParam, PAGE_SIZE);
      setRepositories(prev => append ? [...prev, ...repos] : repos);
      if (showToast) {
        toast.success(`${append ? 'Appended' : 'Loaded'} ${repos.length} repositories from ${githubConfig.organization}`);
      }
    } catch (error) {
      console.error('Failed to fetch repositories:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to fetch repositories: ${errorMessage}`);
      
      // If token is invalid, disconnect
      if (errorMessage.includes('401') || errorMessage.includes('403')) {
        setGithubConfig(() => ({
          token: "",
          organization: "",
          isConnected: false
        }));
        setActiveTab("setup");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectionChange = async (config: GitHubConfig) => {
    // Force refresh repositories when connection changes
    if (config.isConnected && config.token && config.organization) {
      await fetchRepositories(false); // Don't show toast since connection success already shows one
    }
  };

  const handleRefreshRepositories = async () => {
    if (!githubConfig?.isConnected) {
      toast.error("Please connect to GitHub first");
      return;
    }
    
    setPage(1);
    await fetchRepositories(true, false, 1);
  };

  const handleDispatchScan = async (repository: Repository) => {
    if (!githubConfig?.token || !githubConfig?.organization) {
      toast.error("GitHub connection required to dispatch scans");
      return;
    }

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
      
      // Dispatch the actual CodeQL workflow
      const githubService = createGitHubService(githubConfig.token, githubConfig.organization);
      await githubService.dispatchCodeQLScan(repository.name, repository.default_branch);
      
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

      // Poll for completion (in a real app, you might use webhooks)
      setTimeout(async () => {
        try {
          // Check if scan has completed by fetching latest workflow runs
          const runs = await githubService.getWorkflowRuns(repository.name, 'codeql', 1, 1);
          const latestRun = runs[0];
          
          if (latestRun && (latestRun.status === 'completed' || latestRun.conclusion)) {
            const securityFindings = await githubService.getSecurityFindings(repository.name);
            
            const completedRequest: ScanRequest = {
              ...runningRequest,
              status: 'completed',
              duration: Math.round((new Date().getTime() - new Date(scanRequest.timestamp).getTime()) / 1000 / 60), // minutes
              findings: securityFindings
            };

            setScanRequests(prev => (prev || []).map(req => 
              req.id === scanRequest.id ? completedRequest : req
            ));

            setRepositories(prev => prev.map(repo =>
              repo.id === repository.id 
                ? { 
                    ...repo, 
                    last_scan_status: latestRun.conclusion === 'success' ? 'success' as const : 'failure' as const,
                    last_scan_date: latestRun.updated_at,
                    security_findings: securityFindings
                  }
                : repo
            ));

            toast.success(`CodeQL scan completed for ${repository.name}`);
          }
        } catch (error) {
          console.error('Failed to check scan completion:', error);
        }
        
        setScanningRepos(prev => {
          const newSet = new Set(prev);
          newSet.delete(repository.id);
          return newSet;
        });
      }, 30000); // Check after 30 seconds

    } catch (error) {
      console.error('Failed to dispatch scan:', error);
      toast.error(`Failed to dispatch scan for ${repository.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setScanningRepos(prev => {
        const newSet = new Set(prev);
        newSet.delete(repository.id);
        return newSet;
      });
      
      // Update scan request status to failed
      setScanRequests(prev => (prev || []).map(req => 
        req.id === scanRequest.id ? { ...req, status: 'failed' as const } : req
      ));
    }
  };

  const handleRefreshResults = async (repository: Repository) => {
    if (!githubConfig?.token || !githubConfig?.organization) {
      toast.error("GitHub connection required to refresh results");
      return;
    }
    setRefreshingRepos(prev => new Set(prev).add(repository.id));
    try {
      const svc = createGitHubService(githubConfig.token, githubConfig.organization);
      const [findings, analysis] = await Promise.all([
        svc.getSecurityFindings(repository.name),
        svc.analyzeRepositorySetup(repository.name)
      ]);
      setRepositories(prev => prev.map(r => r.id === repository.id ? {
        ...r,
        security_findings: findings,
        last_scan_date: analysis.latestAnalysis?.created_at || r.last_scan_date,
        last_scan_status: analysis.latestAnalysis ? 'success' : r.last_scan_status
      } : r));
      toast.success(`Refreshed results for ${repository.name}`);
    } catch (e) {
      console.warn('Refresh failed', e);
      toast.error(`Failed to refresh ${repository.name}`);
    } finally {
      setRefreshingRepos(prev => { const n = new Set(prev); n.delete(repository.id); return n; });
    }
  };

  const handleViewDetails = (repository: Repository) => {
    setDetailsRepo(repository);
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

  const stats = useMemo(getOverallStats, [repositories]);

  const filteredRepositories = useMemo(() => {
    let list = repositories;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r => r.name.toLowerCase().includes(q) || r.full_name.toLowerCase().includes(q));
    }
    if (severityFilter) {
      list = list.filter(r => {
        const f = r.security_findings;
        if (!f) return severityFilter === 'none';
        switch (severityFilter) {
          case 'critical': return f.critical > 0;
          case 'high': return f.high > 0;
          case 'medium': return f.medium > 0;
          case 'low': return f.low > 0;
          case 'note': return f.note > 0;
          case 'none': return f.total === 0;
          default: return true;
        }
      });
    }
    return list;
  }, [repositories, search, severityFilter]);

  // Persist filters
  useEffect(() => {
    try {
      localStorage.setItem('repo-filters', JSON.stringify({ search, severityFilter }));
    } catch {
      // Ignore localStorage errors (e.g., storage quota exceeded)
    }
  }, [search, severityFilter]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('repo-filters');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.search) setSearch(parsed.search);
        if (parsed.severityFilter) setSeverityFilter(parsed.severityFilter);
      }
    } catch {
      // Ignore localStorage errors (e.g., invalid JSON)
    }
    // run only once
  }, []);

  const canLoadMore = repositories.length >= page * PAGE_SIZE; // heuristic
  const loadMore = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchRepositories(false, true, nextPage);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.25),transparent_60%),radial-gradient(circle_at_70%_80%,hsl(var(--accent)/0.2),transparent_55%)] dark:opacity-30" />
      <Toaster position="top-right" />
      <div className="container mx-auto px-4 py-8 relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg">
              <Shield size={24} className="text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-primary/60 animate-[pulse_8s_ease-in-out_infinite]">CodeQL Security Dashboard</h1>
              <p className="text-muted-foreground">
                Enterprise FedRAMP Compliance Monitoring
                {githubConfig?.isConnected ? (
                  <span className="ml-2 flex items-center gap-1 text-green-600">
                    <CheckCircle size={16} />
                    Connected to <strong>{githubConfig.organization}</strong>{envManaged && <span className="ml-1 text-xs rounded bg-green-100 px-2 py-0.5 text-green-700 border border-green-300">env</span>}
                  </span>
                ) : (
                  <span className="ml-2 text-orange-600">
                    • GitHub connection required
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {githubConfig?.isConnected && (
              <>
                <ExportStatus exportHistory={exportHistory || []} />
                <QuickExport repositories={repositories} />
                <ExportDialog repositories={repositories} onExport={handleExportReport} />
              </>
            )}
            <ThemeToggle />
            <Button
              onClick={handleRefreshRepositories}
              disabled={isLoading || !githubConfig?.isConnected}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowClockwise size={16} className={isLoading ? 'animate-spin' : ''} />
              {isLoading ? "Loading..." : "Refresh"}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="backdrop-blur supports-[backdrop-filter]:bg-background/70 border-border/60 hover:border-primary/30 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Repositories</CardTitle>
              <FileText size={16} className="text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRepos}</div>
              <p className="text-xs text-muted-foreground">CodeQL enabled</p>
            </CardContent>
          </Card>

          <Card className="backdrop-blur supports-[backdrop-filter]:bg-background/70 border-border/60 hover:border-primary/30 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Scans</CardTitle>
              <Activity size={16} className="text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.activeScans}</div>
              <p className="text-xs text-muted-foreground">Currently running</p>
            </CardContent>
          </Card>

          <Card className="backdrop-blur supports-[backdrop-filter]:bg-background/70 border-border/60 hover:border-primary/30 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Findings</CardTitle>
              <Warning size={16} className="text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.totalFindings}</div>
              <p className="text-xs text-muted-foreground">Security issues</p>
            </CardContent>
          </Card>

          <Card className="backdrop-blur supports-[backdrop-filter]:bg-background/70 border-border/60 hover:border-primary/30 transition-colors">
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
        {githubConfig?.isConnected && (
          <Alert className="mb-8 border-accent/20 bg-accent/5">
            <Shield size={16} className="text-accent" />
            <AlertDescription className="text-accent-foreground">
              <strong>FedRAMP Compliance:</strong> Connected to {githubConfig.organization}. 
              All repositories listed have advanced CodeQL workflow dispatch enabled. 
              Scan requests complete within 2-3 minutes to meet audit requirements.
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="setup">Setup</TabsTrigger>
            <TabsTrigger value="repositories" disabled={!githubConfig?.isConnected}>Repositories</TabsTrigger>
            <TabsTrigger value="analytics" disabled={!githubConfig?.isConnected}>Security Analytics</TabsTrigger>
            <TabsTrigger value="audit" disabled={!githubConfig?.isConnected}>Audit Trail</TabsTrigger>
            <TabsTrigger value="exports" disabled={!githubConfig?.isConnected}>Export History</TabsTrigger>
          </TabsList>

          <TabsContent value="setup" className="space-y-6">
            <GitHubConnection onConnectionChange={handleConnectionChange} />
          </TabsContent>

          <TabsContent value="repositories" className="space-y-6">
            {!githubConfig?.isConnected ? (
              <Card>
                <CardContent className="text-center py-8">
                  <GitBranch size={48} className="mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">GitHub Connection Required</h3>
                  <p className="text-muted-foreground mb-4">
                    Please set up your GitHub connection in the Setup tab to view and manage repositories.
                  </p>
                  <Button onClick={() => setActiveTab("setup")}>
                    Go to Setup
                  </Button>
                </CardContent>
              </Card>
            ) : repositories.length === 0 && !isLoading ? (
              <Card>
                <CardContent className="text-center py-8">
                  <FileText size={48} className="mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Repositories Found</h3>
                  <p className="text-muted-foreground mb-4">
                    No repositories found in {githubConfig.organization}. Make sure the organization name is correct and you have access.
                  </p>
                  <Button onClick={handleRefreshRepositories}>
                    <ArrowClockwise size={16} className="mr-2" />
                    Refresh Repositories
                  </Button>
                </CardContent>
              </Card>
            ) : isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-xl border p-6 space-y-4 bg-card/50">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-1/2 bg-muted rounded" />
                        <div className="h-3 w-2/3 bg-muted rounded" />
                      </div>
                    </div>
                    <div className="h-3 w-full bg-muted rounded" />
                    <div className="flex gap-2">
                      <div className="h-9 w-full bg-muted rounded" />
                      <div className="h-9 w-24 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-center gap-2 flex-1">
                      <MagnifyingGlass size={16} className="text-muted-foreground" />
                      <Input placeholder="Search repositories" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {['critical','high','medium','low','note','none'].map(s => (
                        <Badge
                          key={s}
                          onClick={() => setSeverityFilter(prev => prev === s ? null : s)}
                          className={`cursor-pointer select-none ${severityFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                        >{s}</Badge>
                      ))}
                      {severityFilter && (
                        <Button variant="ghost" size="sm" onClick={() => setSeverityFilter(null)}>Clear</Button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><FunnelSimple size={14} /> Showing {filteredRepositories.length} of {repositories.length}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredRepositories.map((repository, idx) => {
                    const scanHistory = scanRequests.filter(s => s.repository === repository.full_name)
                      .sort((a,b)=> new Date(a.timestamp).getTime()-new Date(b.timestamp).getTime())
                      .map(s => ({ timestamp: s.timestamp, findingsTotal: s.findings?.total }));
                    return (
                      <div key={repository.id} style={{ animationDelay: `${idx * 40}ms` }} className="animate-fade-in [animation-fill-mode:both]">
                        <RepositoryCard
                          repository={repository}
                          onDispatchScan={handleDispatchScan}
                          onViewDetails={handleViewDetails}
                          onRefreshLatest={handleRefreshResults}
                          isScanning={scanningRepos.has(repository.id)}
                          isRefreshing={refreshingRepos.has(repository.id)}
                          scanHistory={scanHistory}
                        />
                      </div>
                    );
                  })}
                </div>
                {canLoadMore && (
                  <div className="flex justify-center pt-2">
                    <Button onClick={loadMore} variant="outline" disabled={isLoading} className="min-w-[200px]">
                      {isLoading ? 'Loading…' : 'Load More'}
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-6">
                <SecurityChart 
                  findings={repositories.map(r => r.security_findings || {
                    critical: 0, high: 0, medium: 0, low: 0, note: 0, total: 0
                  })} 
                />
                <ReportGenerationPanel repositories={repositories} organization={githubConfig?.organization} />
              </div>
              <div className="space-y-6">
                <ResultsFreshnessPanel repositories={repositories} />
                <SarifExportPanel repositories={repositories} token={githubConfig?.token} organization={githubConfig?.organization} />
              </div>
            </div>
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
      <RepositoryDetailsDialog
        open={!!detailsRepo}
        onOpenChange={(o) => !o && setDetailsRepo(null)}
        repository={detailsRepo}
        token={githubConfig?.token || ''}
        organization={githubConfig?.organization || ''}
      />
    </div>
  );
}

export default App;