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
import { useKV } from '@github/spark/hooks';

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
  onConnectionChange: (config: GitHubConfig) => void;
}

export function GitHubConnection({ onConnectionChange }: GitHubConnectionProps) {
  const [githubConfig, setGithubConfig] = useKV<GitHubConfig>("github-config", {
    token: "",
    organization: "",
    isConnected: false
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

  useEffect(() => {
    if (githubConfig) {
      setTempToken(githubConfig.token || "");
      setTempOrg(githubConfig.organization || "");
      onConnectionChange(githubConfig);
    }
  }, [githubConfig, onConnectionChange]);

  const verifyConnection = async () => {
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
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!userResponse.ok) {
        throw new Error(`GitHub API error: ${userResponse.status} ${userResponse.statusText}`);
      }

      const userInfo = await userResponse.json();

      // Test organization access
      const orgResponse = await fetch(`https://api.github.com/orgs/${tempOrg}`, {
        headers: {
          'Authorization': `token ${tempToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!orgResponse.ok) {
        throw new Error(`Organization access error: ${orgResponse.status} ${orgResponse.statusText}`);
      }

      const orgInfo = await orgResponse.json();

      // Test repository list access
      const reposResponse = await fetch(`https://api.github.com/orgs/${tempOrg}/repos?per_page=1`, {
        headers: {
          'Authorization': `token ${tempToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!reposResponse.ok) {
        throw new Error(`Repository access error: ${reposResponse.status} ${reposResponse.statusText}`);
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

    try {
      // Test CodeQL alerts access (requires security_events scope)
      const alertsResponse = await fetch(
        `https://api.github.com/orgs/${githubConfig.organization}/code-scanning/alerts?per_page=1`,
        {
          headers: {
            'Authorization': `token ${githubConfig.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      // Test Actions access (requires actions scope)
      const actionsResponse = await fetch(
        `https://api.github.com/orgs/${githubConfig.organization}/actions/workflows?per_page=1`,
        {
          headers: {
            'Authorization': `token ${githubConfig.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      const permissions = {
        repos: true, // We already tested this
        security_events: alertsResponse.ok,
        actions: actionsResponse.ok
      };

      toast.success("Permission check completed");
      return permissions;

    } catch (error) {
      toast.error("Failed to check permissions");
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
                    </AlertDescription>
                  </Alert>

                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="github-token">GitHub Personal Access Token</Label>
                      <div className="relative">
                        <Input
                          id="github-token"
                          type={showToken ? "text" : "password"}
                          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                          value={tempToken}
                          onChange={(e) => setTempToken(e.target.value)}
                          className="pr-10"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                          onClick={() => setShowToken(!showToken)}
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
                        placeholder="your-org-name"
                        value={tempOrg}
                        onChange={(e) => setTempOrg(e.target.value)}
                      />
                    </div>

                    <Button 
                      onClick={verifyConnection} 
                      disabled={isVerifying || !tempToken.trim() || !tempOrg.trim()}
                      className="w-full"
                    >
                      {isVerifying ? "Verifying Connection..." : "Connect to GitHub"}
                    </Button>
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
                    </AlertDescription>
                  </Alert>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={testPermissions}>
                      Test Permissions
                    </Button>
                    <Button variant="destructive" onClick={disconnect}>
                      Disconnect
                    </Button>
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
                          <Badge variant="outline">
                            Click "Test Permissions" to verify
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Actions Workflow</span>
                          <Badge variant="outline">
                            Click "Test Permissions" to verify
                          </Badge>
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