import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { FileText, Download, Eye } from '@phosphor-icons/react';
import type { Repository, ReportType, ReportFormat } from '@/types/dashboard';
import { 
  ComplianceReportGenerator,
  downloadFile,
  printPDF
} from '@/lib/export-utils';
import { toast } from 'sonner';

interface ReportGenerationPanelProps {
  repositories: Repository[];
  organization?: string;
}

export function ReportGenerationPanel({ repositories, organization = "Enterprise Organization" }: ReportGenerationPanelProps) {
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('executive');
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>('pdf');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [lastGeneratedReport, setLastGeneratedReport] = useState<{
    type: ReportType;
    format: ReportFormat;
    fileName: string;
    size: number;
    timestamp: string;
  } | null>(null);

  const reportTypeOptions = [
    { value: 'executive' as const, label: 'Executive Summary', description: 'High-level security posture and key metrics' },
    { value: 'technical' as const, label: 'Technical Detail', description: 'Repository-by-repository findings with remediation guidance' },
    { value: 'compliance' as const, label: 'Compliance Report', description: 'FedRAMP-specific formatting for audit documentation' }
  ];

  const formatOptions = [
    { value: 'pdf' as const, label: 'PDF', description: 'Professional printable format' },
    { value: 'html' as const, label: 'HTML', description: 'Web-viewable format with interactive elements' },
    { value: 'csv' as const, label: 'CSV', description: 'Data export for analysis' },
    { value: 'json' as const, label: 'JSON', description: 'Machine-readable data format' }
  ];

  const generateReport = async () => {
    if (repositories.length === 0) {
      toast.error('No repositories available for report generation');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      let content: string;
      let filename: string;
      let contentType: string;

      // Generate the appropriate report
      if (selectedReportType === 'executive') {
        const report = ComplianceReportGenerator.generateExecutiveSummaryReport(repositories, organization);
        
        if (selectedFormat === 'pdf') {
          content = ComplianceReportGenerator.exportExecutiveReportAsPDF(report);
          filename = `executive-summary-${Date.now()}.html`;
          contentType = 'text/html';
        } else if (selectedFormat === 'html') {
          content = ComplianceReportGenerator.exportExecutiveReportAsPDF(report);
          filename = `executive-summary-${Date.now()}.html`;
          contentType = 'text/html';
        } else if (selectedFormat === 'json') {
          content = JSON.stringify(report, null, 2);
          filename = `executive-summary-${Date.now()}.json`;
          contentType = 'application/json';
        } else {
          // CSV format - create a simplified CSV for executive summary
          const csvLines = [
            'Metric,Value',
            `Total Repositories,${report.executive_summary.total_repositories}`,
            `Scan Coverage,${report.executive_summary.scan_coverage_percent}%`,
            `Critical Issues,${report.executive_summary.critical_issues}`,
            `High Issues,${report.executive_summary.high_issues}`,
            `Risk Score,${report.executive_summary.risk_score}`,
            `Security Posture,${report.executive_summary.security_posture}`,
            `FedRAMP Compliant,${report.compliance_status.fedramp_compliant ? 'Yes' : 'No'}`
          ];
          content = csvLines.join('\n');
          filename = `executive-summary-${Date.now()}.csv`;
          contentType = 'text/csv';
        }
      } else if (selectedReportType === 'technical') {
        const report = ComplianceReportGenerator.generateTechnicalDetailReport(repositories, organization);
        
        if (selectedFormat === 'pdf' || selectedFormat === 'html') {
          content = ComplianceReportGenerator.exportTechnicalReportAsPDF(report);
          filename = `technical-detail-${Date.now()}.html`;
          contentType = 'text/html';
        } else if (selectedFormat === 'json') {
          content = JSON.stringify(report, null, 2);
          filename = `technical-detail-${Date.now()}.json`;
          contentType = 'application/json';
        } else {
          // CSV format for technical report
          const csvLines = [
            'Repository,Owner,Last Scan,Status,Critical,High,Medium,Low,Total,Duration (min)',
            ...report.repository_findings.map(rf => 
              `${rf.repository.name},${rf.repository.owner.login},${rf.scan_details.last_scan_date},${rf.scan_details.scan_status},${rf.findings_breakdown.critical},${rf.findings_breakdown.high},${rf.findings_breakdown.medium},${rf.findings_breakdown.low},${rf.findings_breakdown.total},${rf.scan_details.duration_minutes}`
            )
          ];
          content = csvLines.join('\n');
          filename = `technical-detail-${Date.now()}.csv`;
          contentType = 'text/csv';
        }
      } else {
        // Compliance report
        const report = ComplianceReportGenerator.generateReport(repositories, organization);
        
        if (selectedFormat === 'pdf' || selectedFormat === 'html') {
          content = ComplianceReportGenerator.exportAsPDF(report);
          filename = `compliance-report-${Date.now()}.html`;
          contentType = 'text/html';
        } else if (selectedFormat === 'json') {
          content = ComplianceReportGenerator.exportAsJSON(report);
          filename = `compliance-report-${Date.now()}.json`;
          contentType = 'application/json';
        } else {
          content = ComplianceReportGenerator.exportAsCSV(report);
          filename = `compliance-report-${Date.now()}.csv`;
          contentType = 'text/csv';
        }
      }

      clearInterval(progressInterval);
      setGenerationProgress(100);

      // Download the file
      downloadFile(content, filename, contentType);

      // Store report metadata for display
      setLastGeneratedReport({
        type: selectedReportType,
        format: selectedFormat,
        fileName: filename,
        size: new Blob([content], { type: contentType }).size,
        timestamp: new Date().toISOString()
      });

      toast.success(`${reportTypeOptions.find(r => r.value === selectedReportType)?.label} report generated successfully`);
    } catch (error) {
      console.error('Report generation failed:', error);
      toast.error('Failed to generate report. Please try again.');
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const previewReport = () => {
    if (repositories.length === 0) {
      toast.error('No repositories available for preview');
      return;
    }

    try {
      let content: string;

      if (selectedReportType === 'executive') {
        const report = ComplianceReportGenerator.generateExecutiveSummaryReport(repositories, organization);
        content = ComplianceReportGenerator.exportExecutiveReportAsPDF(report);
      } else if (selectedReportType === 'technical') {
        const report = ComplianceReportGenerator.generateTechnicalDetailReport(repositories, organization);
        content = ComplianceReportGenerator.exportTechnicalReportAsPDF(report);
      } else {
        const report = ComplianceReportGenerator.generateReport(repositories, organization);
        content = ComplianceReportGenerator.exportAsPDF(report);
      }

      printPDF(content);
      toast.success('Opening report preview...');
    } catch (error) {
      console.error('Preview failed:', error);
      toast.error('Failed to generate preview');
    }
  };

  const selectedReportTypeInfo = reportTypeOptions.find(r => r.value === selectedReportType);
  const selectedFormatInfo = formatOptions.find(f => f.value === selectedFormat);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <FileText size={20} className="text-primary" />
          Professional Report Generation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Report Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Report Type</label>
            <Select value={selectedReportType} onValueChange={(value) => setSelectedReportType(value as ReportType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reportTypeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Output Format</label>
            <Select value={selectedFormat} onValueChange={(value) => setSelectedFormat(value as ReportFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {formatOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Report Information */}
        <div className="bg-muted/50 p-3 rounded-lg">
          <h4 className="font-medium mb-2">Report Configuration</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Type:</strong> {selectedReportTypeInfo?.label} - {selectedReportTypeInfo?.description}</p>
            <p><strong>Format:</strong> {selectedFormatInfo?.label} - {selectedFormatInfo?.description}</p>
            <p><strong>Data Source:</strong> {repositories.length} repositories from {organization}</p>
          </div>
        </div>

        {/* Generation Progress */}
        {isGenerating && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Generating report...</span>
              <span>{generationProgress}%</span>
            </div>
            <Progress value={generationProgress} className="w-full" />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={generateReport}
            disabled={isGenerating || repositories.length === 0}
            className="flex items-center gap-2"
          >
            <Download size={16} />
            {isGenerating ? 'Generating...' : 'Generate Report'}
          </Button>
          
          <Button
            variant="outline"
            onClick={previewReport}
            disabled={isGenerating || repositories.length === 0}
            className="flex items-center gap-2"
          >
            <Eye size={16} />
            Preview
          </Button>
        </div>

        {/* Last Generated Report Info */}
        {lastGeneratedReport && (
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">Last Generated Report</h4>
            <div className="text-sm text-muted-foreground">
              <p><strong>Type:</strong> {reportTypeOptions.find(r => r.value === lastGeneratedReport.type)?.label}</p>
              <p><strong>Format:</strong> {lastGeneratedReport.format.toUpperCase()}</p>
              <p><strong>File:</strong> {lastGeneratedReport.fileName}</p>
              <p><strong>Size:</strong> {(lastGeneratedReport.size / 1024).toFixed(1)} KB</p>
              <p><strong>Generated:</strong> {new Date(lastGeneratedReport.timestamp).toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Footer Information */}
        <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded">
          <p><strong>Report Features:</strong></p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>Professional formatting suitable for compliance documentation</li>
            <li>Real-time data from latest CodeQL scan results</li>
            <li>FedRAMP compliance status and requirements assessment</li>
            <li>Executive summaries and detailed technical findings</li>
            <li>Export options for sharing and archiving</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}