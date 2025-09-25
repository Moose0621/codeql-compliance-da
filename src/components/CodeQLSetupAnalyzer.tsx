import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
import { analyzeCodeQLCapabilities, generateMigrationPlan, validateOnDemandScanning, type WorkflowCapabilities } from '@/lib/codeql-analysis';
import { createGitHubService } from '@/lib/github-service';
import { getEnvConfig } from '@/lib/env-config';

interface CodeQLSetupAnalyzerProps {
  repositoryName: string;
  onAnalysisComplete?: (capabilities: WorkflowCapabilities) => void;
}

export function CodeQLSetupAnalyzer({ repositoryName, onAnalysisComplete }: CodeQLSetupAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [capabilities, setCapabilities] = useState<WorkflowCapabilities | null>(null);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeRepository = async () => {
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const config = getEnvConfig();
      if (!config.token || !config.org) {
        throw new Error('GitHub token and organization must be configured');
      }

      const githubService = createGitHubService(config.token, config.org);
      
      // Analyze capabilities
      const caps = await analyzeCodeQLCapabilities(githubService, repositoryName);
      setCapabilities(caps);
      
      // Validate if on-demand scanning should work
      if (caps.hasCodeQLWorkflow) {
        const validation = await validateOnDemandScanning(githubService, repositoryName);
        setValidationResult(validation);
      }
      
      onAnalysisComplete?.(caps);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getStatusIcon = (canTrigger: boolean, hasWorkflow: boolean) => {
    if (!hasWorkflow) return <XCircle className="h-5 w-5 text-red-500" />;
    if (canTrigger) return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
  };

  const getWorkflowTypeBadge = (type: string) => {
    const variants = {
      'advanced-setup': 'default',
      'default-setup': 'secondary', 
      'none': 'destructive'
    } as const;
    
    return (
      <Badge variant={variants[type as keyof typeof variants] || 'outline'}>
        {type.replace('-', ' ').toUpperCase()}
      </Badge>
    );
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          CodeQL Setup Analysis
        </CardTitle>
        <CardDescription>
          Analyze repository CodeQL configuration and on-demand scanning capabilities
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!capabilities && (
          <div className="text-center py-8">
            <Button 
              onClick={analyzeRepository} 
              disabled={isAnalyzing}
              size="lg"
            >
              {isAnalyzing ? 'Analyzing...' : `Analyze ${repositoryName}`}
            </Button>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Analysis Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {capabilities && (
          <div className="space-y-6">
            {/* Status Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">CodeQL Workflow</p>
                      <p className="text-2xl font-bold">
                        {capabilities.hasCodeQLWorkflow ? 'Present' : 'Missing'}
                      </p>
                    </div>
                    {getStatusIcon(capabilities.canTriggerOnDemand, capabilities.hasCodeQLWorkflow)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Setup Type</p>
                      <div className="mt-2">
                        {getWorkflowTypeBadge(capabilities.workflowType)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">On-Demand Scanning</p>
                      <p className="text-2xl font-bold">
                        {capabilities.canTriggerOnDemand ? 'Available' : 'Not Available'}
                      </p>
                    </div>
                    {getStatusIcon(capabilities.canTriggerOnDemand, capabilities.hasCodeQLWorkflow)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recommendations */}
            {capabilities.recommendations.length > 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Recommendations</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 space-y-1">
                    {capabilities.recommendations.map((rec, index) => (
                      <li key={index} className="text-sm">• {rec}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Migration Plan */}
            {!capabilities.canTriggerOnDemand && (
              <Card>
                <CardHeader>
                  <CardTitle>Migration Plan</CardTitle>
                  <CardDescription>Steps to enable on-demand scanning</CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const plan = generateMigrationPlan(capabilities);
                    return (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            plan.priority === 'high' ? 'destructive' : 
                            plan.priority === 'medium' ? 'default' : 'secondary'
                          }>
                            {plan.priority.toUpperCase()} PRIORITY
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            Estimated time: {plan.timeline}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-medium mb-2">Steps:</h4>
                          <ol className="space-y-1">
                            {plan.steps.map((step, index) => (
                              <li key={index} className="text-sm flex gap-2">
                                <span className="font-medium text-muted-foreground">{index + 1}.</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>

                        {plan.risks.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2 text-yellow-600">Risks to Consider:</h4>
                            <ul className="space-y-1">
                              {plan.risks.map((risk, index) => (
                                <li key={index} className="text-sm text-yellow-600">• {risk}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Validation Results */}
            {validationResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {validationResult.isValid ? 
                      <CheckCircle2 className="h-5 w-5 text-green-500" /> :
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    }
                    Validation Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {validationResult.issues.length > 0 && (
                    <div>
                      <h4 className="font-medium text-red-600 mb-2">Issues Found:</h4>
                      <ul className="space-y-1">
                        {validationResult.issues.map((issue: string, index: number) => (
                          <li key={index} className="text-sm text-red-600">• {issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validationResult.suggestions.length > 0 && (
                    <div>
                      <h4 className="font-medium text-blue-600 mb-2">Suggestions:</h4>
                      <ul className="space-y-1">
                        {validationResult.suggestions.map((suggestion: string, index: number) => (
                          <li key={index} className="text-sm text-blue-600">• {suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setCapabilities(null);
                  setValidationResult(null);
                }}
              >
                Analyze Another Repository
              </Button>
              
              {capabilities.canTriggerOnDemand && (
                <Button>
                  Test On-Demand Scan
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}