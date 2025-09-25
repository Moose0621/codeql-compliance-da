import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Download, FileText, Table, Code, Shield, Calendar, Buildings } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { Repository, ExportFormat, ComplianceReport } from "@/types/dashboard";
import { ComplianceReportGenerator, downloadFile, printPDF } from "@/lib/export-utils";

interface ExportDialogProps {
  repositories: Repository[];
  onExport?: (format: ExportFormat, report: ComplianceReport) => void;
}

export function ExportDialog({ repositories, onExport }: ExportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
  const [organizationName, setOrganizationName] = useState('Enterprise Organization');
  const [isExporting, setIsExporting] = useState(false);

  const report = ComplianceReportGenerator.generateReport(repositories, organizationName);

  const formatOptions = [
    {
      value: 'pdf' as const,
      label: 'PDF Report',
      description: 'Comprehensive compliance report for auditors',
      icon: FileText,
      recommended: true
    },
    {
      value: 'csv' as const,
      label: 'CSV Data',
      description: 'Spreadsheet data for analysis',
      icon: Table,
      recommended: false
    },
    {
      value: 'json' as const,
      label: 'JSON Data',
      description: 'Structured data for API integration',
      icon: Code,
      recommended: false
    }
  ];

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      let filename: string;
      let content: string;
      let contentType: string;

      switch (selectedFormat) {
        case 'pdf':
          content = ComplianceReportGenerator.exportAsPDF(report);
          printPDF(content);
          toast.success("PDF report opened for printing/saving");
          break;
          
        case 'csv':
          content = ComplianceReportGenerator.exportAsCSV(report);
          filename = `fedramp-compliance-report-${timestamp}.csv`;
          contentType = 'text/csv';
          downloadFile(content, filename, contentType);
          toast.success("CSV report downloaded successfully");
          break;
          
        case 'json':
          content = ComplianceReportGenerator.exportAsJSON(report);
          filename = `fedramp-compliance-report-${timestamp}.json`;
          contentType = 'application/json';
          downloadFile(content, filename, contentType);
          toast.success("JSON report downloaded successfully");
          break;
      }

      onExport?.(selectedFormat, report);
      setIsOpen(false);
      
    } catch (error) {
      toast.error("Failed to export report");
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const getComplianceStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'bg-green-100 text-green-800';
      case 'non-compliant': return 'bg-red-100 text-red-800';
      case 'partial': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Download size={16} />
          Export Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield size={20} className="text-primary" />
            Export Compliance Audit Report
          </DialogTitle>
          <DialogDescription>
            Generate a FedRAMP-compliant security audit report for your organization's repositories.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Report Preview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText size={16} />
                Report Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Buildings size={16} className="text-muted-foreground" />
                  <span className="font-medium">Organization:</span>
                  <span>{report.organization}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-muted-foreground" />
                  <span className="font-medium">Report Period:</span>
                  <span>30 days</span>
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{report.summary.total_repositories}</div>
                  <div className="text-xs text-muted-foreground">Repositories</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{report.summary.total_findings.total}</div>
                  <div className="text-xs text-muted-foreground">Total Findings</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{report.summary.last_scan_coverage}%</div>
                  <div className="text-xs text-muted-foreground">Scan Coverage</div>
                </div>
              </div>

              <div className="flex items-center justify-center pt-2">
                <Badge className={getComplianceStatusColor(report.summary.compliance_status)}>
                  {report.summary.compliance_status.toUpperCase()}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Organization Settings */}
          <div className="space-y-2">
            <Label htmlFor="organization">Organization Name</Label>
            <Input
              id="organization"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="Enter your organization name"
            />
          </div>

          {/* Format Selection */}
          <div className="space-y-3">
            <Label>Export Format</Label>
            <div className="grid gap-3">
              {formatOptions.map((option) => (
                <Card 
                  key={option.value}
                  className={`cursor-pointer transition-colors ${
                    selectedFormat === option.value ? 'ring-2 ring-primary' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedFormat(option.value)}
                >
                  <CardContent className="flex items-center gap-3 p-4">
                    <option.icon size={20} className="text-primary" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{option.label}</span>
                        {option.recommended && (
                          <Badge variant="secondary" className="text-xs">Recommended</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                    <div className="flex items-center">
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        selectedFormat === option.value 
                          ? 'border-primary bg-primary' 
                          : 'border-muted-foreground'
                      }`}>
                        {selectedFormat === option.value && (
                          <div className="w-2 h-2 bg-primary-foreground rounded-full m-0.5" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* FedRAMP Requirements Check */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">FedRAMP Compliance Status</CardTitle>
              <CardDescription>Required criteria for federal compliance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Scan Frequency Requirements</span>
                <Badge variant={report.fedramp_requirements.scan_frequency_met ? "default" : "destructive"}>
                  {report.fedramp_requirements.scan_frequency_met ? "✓ Met" : "✗ Not Met"}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Response Time (2-3 minutes)</span>
                <Badge variant={report.fedramp_requirements.response_time_met ? "default" : "destructive"}>
                  {report.fedramp_requirements.response_time_met ? "✓ Met" : "✗ Not Met"}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Documentation Complete</span>
                <Badge variant={report.fedramp_requirements.documentation_complete ? "default" : "destructive"}>
                  {report.fedramp_requirements.documentation_complete ? "✓ Complete" : "✗ Incomplete"}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Remediation Tracking</span>
                <Badge variant={report.fedramp_requirements.remediation_tracked ? "default" : "destructive"}>
                  {report.fedramp_requirements.remediation_tracked ? "✓ Tracked" : "✗ Not Tracked"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? "Exporting..." : `Export ${selectedFormat.toUpperCase()}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}