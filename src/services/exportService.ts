// Export Service for Reports and Data
// Supports CSV, PDF, and JSON exports

import { ContentItem } from '../SocialModerationSection';

interface ExportOptions {
  format: 'csv' | 'pdf' | 'json';
  includeAnalysis?: boolean;
  dateRange?: { start: string; end: string };
  filters?: any;
}

interface ExportStats {
  totalItems: number;
  flaggedItems: number;
  approvedItems: number;
  rejectedItems: number;
  pendingItems: number;
  avgToxicity: number;
  avgBrandSafety: number;
  platformBreakdown: Record<string, number>;
  severityBreakdown: Record<string, number>;
  categoryBreakdown: Record<string, number>;
}

class ExportService {
  // Export content items to CSV
  exportToCSV(items: ContentItem[], options: ExportOptions = { format: 'csv' }): void {
    const headers = [
      'ID',
      'Platform',
      'Content',
      'Author',
      'Timestamp',
      'Status',
      'Severity',
      'Category',
      'AI Confidence',
      ...(options.includeAnalysis ? ['Sentiment', 'Toxicity', 'Brand Safety'] : [])
    ];

    const csvContent = [
      headers.join(','),
      ...items.map(item => [
        `"${item.id}"`,
        `"${item.platform}"`,
        `"${this.escapeCsvField(item.content)}"`,
        `"${item.author}"`,
        `"${item.timestamp.toISOString()}"`,
        `"${item.status}"`,
        `"${item.severity}"`,
        `"${item.category}"`,
        `"${item.aiConfidence}%"`,
        ...(options.includeAnalysis ? [
          `"${item.sentiment || 'N/A'}"`,
          `"${item.toxicity ? (item.toxicity * 100).toFixed(1) + '%' : 'N/A'}"`,
          `"${item.brandSafety ? (item.brandSafety * 100).toFixed(1) + '%' : 'N/A'}"`
        ] : [])
      ].join(','))
    ].join('\n');

    this.downloadFile(csvContent, `moderation-report-${this.getDateString()}.csv`, 'text/csv');
  }

  // Export content items to JSON
  exportToJSON(items: ContentItem[], stats: ExportStats, options: ExportOptions = { format: 'json' }): void {
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalItems: items.length,
        filters: options.filters || {},
        dateRange: options.dateRange
      },
      statistics: stats,
      items: options.includeAnalysis ? items : items.map(item => ({
        id: item.id,
        platform: item.platform,
        content: item.content,
        author: item.author,
        timestamp: item.timestamp,
        status: item.status,
        severity: item.severity,
        category: item.category,
        aiConfidence: item.aiConfidence
      }))
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    this.downloadFile(jsonContent, `moderation-report-${this.getDateString()}.json`, 'application/json');
  }

  // Export to PDF (simplified version - for full PDF, would need jsPDF)
  exportToPDF(items: ContentItem[], stats: ExportStats): void {
    const htmlContent = this.generateHTMLReport(items, stats);
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      // Trigger print dialog
      printWindow.onload = () => {
        printWindow.print();
        printWindow.close();
      };
    }
  }

  // Generate comprehensive statistics
  generateStats(items: ContentItem[]): ExportStats {
    const total = items.length;
    const flagged = items.filter(item => item.status === 'flagged').length;
    const approved = items.filter(item => item.status === 'approved').length;
    const rejected = items.filter(item => item.status === 'rejected').length;
    const pending = items.filter(item => item.status === 'pending').length;

    const toxicityValues = items.filter(item => item.toxicity !== undefined).map(item => item.toxicity!);
    const brandSafetyValues = items.filter(item => item.brandSafety !== undefined).map(item => item.brandSafety!);

    const avgToxicity = toxicityValues.length > 0 
      ? toxicityValues.reduce((sum, val) => sum + val, 0) / toxicityValues.length 
      : 0;

    const avgBrandSafety = brandSafetyValues.length > 0 
      ? brandSafetyValues.reduce((sum, val) => sum + val, 0) / brandSafetyValues.length 
      : 0;

    const platformBreakdown = items.reduce((acc, item) => {
      acc[item.platform] = (acc[item.platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const severityBreakdown = items.reduce((acc, item) => {
      acc[item.severity] = (acc[item.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const categoryBreakdown = items.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalItems: total,
      flaggedItems: flagged,
      approvedItems: approved,
      rejectedItems: rejected,
      pendingItems: pending,
      avgToxicity,
      avgBrandSafety,
      platformBreakdown,
      severityBreakdown,
      categoryBreakdown
    };
  }

  // Generate HTML report for PDF export
  private generateHTMLReport(items: ContentItem[], stats: ExportStats): string {
    const date = new Date().toLocaleDateString();
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Social Media Moderation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        .stat-number { font-size: 24px; font-weight: bold; color: #2563eb; }
        .stat-label { color: #666; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f5f5f5; }
        .status-approved { color: #16a34a; }
        .status-rejected { color: #dc2626; }
        .status-flagged { color: #ea580c; }
        .status-pending { color: #2563eb; }
        .severity-critical { color: #dc2626; font-weight: bold; }
        .severity-high { color: #ea580c; }
        .severity-medium { color: #ca8a04; }
        .severity-low { color: #16a34a; }
        @media print { body { margin: 0; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>Social Media Moderation Report</h1>
        <p>Generated on ${date}</p>
    </div>
    
    <div class="stats">
        <div class="stat-card">
            <div class="stat-number">${stats.totalItems}</div>
            <div class="stat-label">Total Items</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.flaggedItems}</div>
            <div class="stat-label">Flagged Items</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${(stats.avgToxicity * 100).toFixed(1)}%</div>
            <div class="stat-label">Avg Toxicity</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${(stats.avgBrandSafety * 100).toFixed(1)}%</div>
            <div class="stat-label">Avg Brand Safety</div>
        </div>
    </div>

    <h2>Platform Breakdown</h2>
    <table>
        <tr><th>Platform</th><th>Count</th><th>Percentage</th></tr>
        ${Object.entries(stats.platformBreakdown).map(([platform, count]) => `
            <tr>
                <td>${platform}</td>
                <td>${count}</td>
                <td>${((count / stats.totalItems) * 100).toFixed(1)}%</td>
            </tr>
        `).join('')}
    </table>

    <h2>Content Items</h2>
    <table>
        <tr>
            <th>Platform</th>
            <th>Content</th>
            <th>Author</th>
            <th>Status</th>
            <th>Severity</th>
            <th>Category</th>
            <th>AI Confidence</th>
        </tr>
        ${items.slice(0, 100).map(item => `
            <tr>
                <td>${item.platform}</td>
                <td>${this.truncateText(item.content, 100)}</td>
                <td>${item.author}</td>
                <td class="status-${item.status}">${item.status}</td>
                <td class="severity-${item.severity}">${item.severity}</td>
                <td>${item.category}</td>
                <td>${item.aiConfidence}%</td>
            </tr>
        `).join('')}
    </table>
    
    ${items.length > 100 ? `<p><em>Showing first 100 items of ${items.length} total items.</em></p>` : ''}
</body>
</html>`;
  }

  // Helper methods
  private escapeCsvField(field: string): string {
    return field.replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, '');
  }

  private truncateText(text: string, maxLength: number): string {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  private getDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Export moderation rules
  exportModerationRules(rules: any[]): void {
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalRules: rules.length
      },
      rules: rules
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    this.downloadFile(jsonContent, `moderation-rules-${this.getDateString()}.json`, 'application/json');
  }

  // Import moderation rules
  importModerationRules(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);
          
          if (data.rules && Array.isArray(data.rules)) {
            resolve(data.rules);
          } else {
            reject(new Error('Invalid file format'));
          }
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
}

export const exportService = new ExportService();
export type { ExportOptions, ExportStats };
