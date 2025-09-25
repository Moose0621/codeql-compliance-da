import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, FileText, Table, Code } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { Repository } from "@/types/dashboard";
import { ComplianceReportGenerator, downloadFile, printPDF } from "@/lib/export-utils";

interface QuickExportProps {
  repositories: Repository[];
  organizationName?: string;
}

export function QuickExport({ repositories, organizationName = "Enterprise Organization" }: QuickExportProps) {
  const handleQuickExport = (format: 'pdf' | 'csv' | 'json') => {
    const report = ComplianceReportGenerator.generateReport(repositories, organizationName);
    const timestamp = new Date().toISOString().split('T')[0];

    try {
      switch (format) {
        case 'pdf':
          const pdfContent = ComplianceReportGenerator.exportAsPDF(report);
          printPDF(pdfContent);
          toast.success("PDF report opened for printing/saving");
          break;
          
        case 'csv':
          const csvContent = ComplianceReportGenerator.exportAsCSV(report);
          const csvFilename = `compliance-quick-export-${timestamp}.csv`;
          downloadFile(csvContent, csvFilename, 'text/csv');
          toast.success("CSV data downloaded");
          break;
          
        case 'json':
          const jsonContent = ComplianceReportGenerator.exportAsJSON(report);
          const jsonFilename = `compliance-quick-export-${timestamp}.json`;
          downloadFile(jsonContent, jsonFilename, 'application/json');
          toast.success("JSON data downloaded");
          break;
      }
    } catch (error) {
      toast.error(`Failed to export ${format.toUpperCase()} report`);
      console.error('Quick export error:', error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Download size={14} />
          Quick Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => handleQuickExport('pdf')} className="flex items-center gap-2">
          <FileText size={14} />
          Export PDF Report
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleQuickExport('csv')} className="flex items-center gap-2">
          <Table size={14} />
          Download CSV Data
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleQuickExport('json')} className="flex items-center gap-2">
          <Code size={14} />
          Download JSON Data
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}