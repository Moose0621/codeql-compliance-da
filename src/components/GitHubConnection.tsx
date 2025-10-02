import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GitBranch, Key, Shield, CheckCircle, XCircle, Eye, EyeSlash } from "@phosphor-icons/react";
import { toast } from "sonner";
// Replaced Spark useKV with localStorage-based fallback hook
import { usePersistentConfig } from '@/hooks/usePersistentConfig';

// Environment-provided configuration (system configuration fallback)
// Extracted via helper to allow test-time mocking.
import { getEnvConfig } from '@/lib/env-config';
const { token: ENV_TOKEN, org: ENV_ORG } = getEnvConfig();
const ENV_MANAGED = !!(ENV_TOKEN && ENV_ORG);

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

interface GitHubConnectionProps {
  onConnectionChange: (config: GitHubConfig) => Promise<void>;
}

export function GitHubConnection({ onConnectionChange }: GitHubConnectionProps) {
  // Initialize from environment if present so users in environments where
  // the Spark KV store is unreliable still get a working baseline.
  const [githubConfig, setGithubConfig] = usePersistentConfig<GitHubConfig>("github-config", {
    token: ENV_TOKEN || "",
    organization: ENV_ORG || "",
    isConnected: ENV_MANAGED,
    lastVerified: ENV_MANAGED ? new Date().toISOString() : undefined
  });
  
  const [tempToken, setTempToken] = useState("");
  const [tempOrg, setTempOrg] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    message: string;
    userInfo?: any;
    orgInfo?: any;
  } | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<{
    security_events: boolean | null;
    actions: boolean | null;
  }>({
    security_events: null,
    actions: null
  });

  useEffect(() => {
    if (githubConfig) {
      setTempToken(githubConfig.token || "");
      setTempOrg(githubConfig.organization || "");
      // Call the callback but don't wait for it in useEffect
      onConnectionChange(githubConfig).catch(console.error);
    }
  }, [githubConfig?.isConnected, githubConfig?.token, githubConfig?.organization, onConnectionChange]);

  const verifyConnection = async () => {
    if (ENV_MANAGED) {
      // Already managed by env; surface a toast and exit early.
      toast.success("GitHub connection is managed via environment configuration");
      return;
    }

    if (!tempToken.trim() || !tempOrg.trim()) {
      toast.error("Please provide both GitHub token and organization name");
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);

    try {
      // Test GitHub API connection
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${tempToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });

      if (!userResponse.ok) {
        const errorText = await userResponse.text();
        throw new Error(`GitHub API error: ${userResponse.status} ${userResponse.statusText}${errorText ? ` - ${errorText}` : ''}`);
      }

      const userInfo = await userResponse.json();

      // Test organization access
      const orgResponse = await fetch(`https://api.github.com/orgs/${tempOrg}`, {
        headers: {
          'Authorization': `token ${tempToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });

      if (!orgResponse.ok) {
        const errorText = await orgResponse.text();
        throw new Error(`Organization access error: ${orgResponse.status} ${orgResponse.statusText}${errorText ? ` - ${errorText}` : ''}`);
      }

      const orgInfo = await orgResponse.json();

      // Test repository list access
      const reposResponse = await fetch(`https://api.github.com/orgs/${tempOrg}/repos?per_page=1`, {
        headers: {
          'Authorization': `token ${tempToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });

      if (!reposResponse.ok) {
        const errorText = await reposResponse.text();
        throw new Error(`Repository access error: ${reposResponse.status} ${reposResponse.statusText}${errorText ? ` - ${errorText}` : ''}`);
      }

      setVerificationResult({
        success: true,
        message: "Connection verified successfully!",
        userInfo,
        orgInfo
      });

      const newConfig: GitHubConfig = {
        token: tempToken,
        organization: tempOrg,
        isConnected: true,
        lastVerified: new Date().toISOString(),
        userInfo: {
          login: userInfo.login,
          name: userInfo.name,
          avatar_url: userInfo.avatar_url
        }
      };

      setGithubConfig(newConfig);
      toast.success("GitHub connection established successfully!");

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setVerificationResult({
        success: false,
        message: errorMessage
      });
      toast.error("Failed to connect to GitHub");
    } finally {
      setIsVerifying(false);
    }
  };

  const disconnect = () => {
    if (ENV_MANAGED) {
      toast.error("Cannot disconnect an environment-managed configuration. Remove VITE_GITHUB_TOKEN / VITE_GITHUB_ORG from your .env.local to manage via UI.");
      return;
    }
    const resetConfig: GitHubConfig = {
      token: "",
      organization: "",
      isConnected: false
    };
    setGithubConfig(resetConfig);
    setTempToken("");
    setTempOrg("");
    setVerificationResult(null);
    toast.success("Disconnected from GitHub");
  };

  const testPermissions = async () => {
    if (!githubConfig?.token || !githubConfig?.organization) return;
    if (ENV_MANAGED) {
      // Environment managed; permissions test still valid.
    }

    try {
      // Test CodeQL alerts access (requires security_events scope)
      const alertsResponse = await fetch(
        `https://api.github.com/orgs/${githubConfig.organization}/code-scanning/alerts?per_page=1`,
        {
          headers: {
            'Authorization': `token ${githubConfig.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      );

      // Test Actions access (requires actions scope)
      const actionsResponse = await fetch(
        `https://api.github.com/orgs/${githubConfig.organization}/actions/workflows?per_page=1`,
        {
          headers: {
            'Authorization': `token ${githubConfig.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      );

      const newPermissionStatus = {
        security_events: alertsResponse.ok,
        actions: actionsResponse.ok
      };

      setPermissionStatus(newPermissionStatus);
      toast.success("Permission check completed");
      return newPermissionStatus;

    } catch {
      toast.error("Failed to check permissions");
    }
  };

  const testExistingConnection = async () => {
  if (!githubConfig?.token || !githubConfig?.organization) return;

    setIsVerifying(true);
    try {
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${githubConfig.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });

      if (!userResponse.ok) {
        throw new Error(`Connection test failed: ${userResponse.status} ${userResponse.statusText}`);
      }

      // Test organization access
      const orgResponse = await fetch(`https://api.github.com/orgs/${githubConfig.organization}/repos?per_page=1`, {
        headers: {
          'Authorization': `token ${githubConfig.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });

      if (!orgResponse.ok) {
        throw new Error(`Organization access failed: ${orgResponse.status} ${orgResponse.statusText}`);
      }

      // Update last verified timestamp
      setGithubConfig(prev => ({
        ...prev!,
        lastVerified: new Date().toISOString()
      }));

      toast.success("Connection test successful!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      toast.error(`Connection test failed: ${errorMessage}`);
      
      // If connection failed, mark as disconnected
      setGithubConfig(prev => ({
        ...prev!,
        isConnected: false
      }));
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch size={20} />
            GitHub Organization Connection
          </CardTitle>
          {githubConfig?.isConnected && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle size={14} className="mr-1" />
                Connected
              </Badge>
              <span className="text-sm text-muted-foreground">
                Last verified: {githubConfig.lastVerified && new Date(githubConfig.lastVerified).toLocaleString()}
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="setup" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="setup">Setup</TabsTrigger>
              <TabsTrigger value="status">Connection Status</TabsTrigger>
            </TabsList>

            <TabsContent value="setup" className="space-y-4">
              {!githubConfig?.isConnected ? (
                <div className="space-y-4">
                  <Alert>
                    <Key size={16} />
                    <AlertDescription>
                      You'll need a GitHub Personal Access Token with the following permissions:
                      <br />• <code>repo</code> - Access to repositories
                      <br />• <code>security_events</code> - Read code scanning alerts
                      <br />• <code>actions:read</code> - Read workflow runs and dispatch workflows
                      {ENV_MANAGED && (
                        <>
                          <br />
                          <strong className="block mt-2">Environment managed</strong>
                          Token & organization supplied via system config (.env). UI fields are disabled.
                        </>
                      )}
                    </AlertDescription>
                  </Alert>

                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="github-token">GitHub Personal Access Token</Label>
                      <div className="relative">
                        <Input
                          id="github-token"
                          type={showToken ? "text" : "password"}
                          placeholder={ENV_MANAGED ? "(managed by environment)" : "ghp_xxxxxxxxxxxxxxxxxxxx"}
                          value={tempToken}
                          onChange={(e) => setTempToken(e.target.value)}
                          className="pr-10"
                          disabled={ENV_MANAGED}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                          onClick={() => setShowToken(!showToken)}
                          disabled={ENV_MANAGED}
                        >
                          {showToken ? <EyeSlash size={16} /> : <Eye size={16} />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="github-org">Organization Name</Label>
                      <Input
                        id="github-org"
                        type="text"
                        placeholder={ENV_MANAGED ? "(managed by environment)" : "your-org-name"}
                        value={tempOrg}
                        onChange={(e) => setTempOrg(e.target.value)}
                        disabled={ENV_MANAGED}
                      />
                    </div>

                    {!ENV_MANAGED && (
                      <Button 
                        onClick={verifyConnection} 
                        disabled={isVerifying || !tempToken.trim() || !tempOrg.trim()}
                        className="w-full"
                      >
                        {isVerifying ? "Verifying Connection..." : "Connect to GitHub"}
                      </Button>
                    )}
                  </div>

                  {verificationResult && (
                    <Alert className={verificationResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                      {verificationResult.success ? (
                        <CheckCircle size={16} className="text-green-600" />
                      ) : (
                        <XCircle size={16} className="text-red-600" />
                      )}
                      <AlertDescription className={verificationResult.success ? "text-green-700" : "text-red-700"}>
                        {verificationResult.message}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle size={16} className="text-green-600" />
                    <AlertDescription className="text-green-700">
                      Successfully connected to <strong>{githubConfig.organization}</strong> as <strong>{githubConfig.userInfo?.login}</strong>
                      {ENV_MANAGED && (
                        <span className="block mt-1 text-xs opacity-80">(Connection managed via environment variables)</span>
                      )}
                    </AlertDescription>
                  </Alert>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={testExistingConnection} disabled={isVerifying}>
                      {isVerifying ? "Testing..." : "Test Connection"}
                    </Button>
                    <Button variant="outline" onClick={testPermissions}>
                      Check Permissions
                    </Button>
                    {!ENV_MANAGED && (
                      <Button variant="destructive" onClick={disconnect}>
                        Disconnect
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="status" className="space-y-4">
              {githubConfig?.isConnected ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">User Information</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {githubConfig.userInfo && (
                          <div className="flex items-center gap-3">
                            <img 
                              src={githubConfig.userInfo.avatar_url} 
                              alt={githubConfig.userInfo.login}
                              className="w-10 h-10 rounded-full"
                            />
                            <div>
                              <p className="font-medium">{githubConfig.userInfo.name || githubConfig.userInfo.login}</p>
                              <p className="text-sm text-muted-foreground">@{githubConfig.userInfo.login}</p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Organization</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="font-medium">{githubConfig.organization}</p>
                        <p className="text-sm text-muted-foreground">Ready for repository scanning</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Shield size={16} />
                        Required Permissions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Repository Access</span>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <CheckCircle size={12} className="mr-1" />
                            Granted
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Security Events</span>
                          {permissionStatus.security_events === null ? (
                            <Badge variant="outline">
                              Click "Check Permissions" to verify
                            </Badge>
                          ) : permissionStatus.security_events ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <CheckCircle size={12} className="mr-1" />
                              Granted
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              <XCircle size={12} className="mr-1" />
                              Denied
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Actions Workflow</span>
                          {permissionStatus.actions === null ? (
                            <Badge variant="outline">
                              Click "Check Permissions" to verify
                            </Badge>
                          ) : permissionStatus.actions ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <CheckCircle size={12} className="mr-1" />
                              Granted
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              <XCircle size={12} className="mr-1" />
                              Denied
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Alert>
                  <XCircle size={16} />
                  <AlertDescription>
                    No GitHub connection configured. Please set up your connection in the Setup tab.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}