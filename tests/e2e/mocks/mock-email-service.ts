// Mock Email Service for E2E Testing
import type { MockEmailDelivery, NotificationEvent } from '@/types/notifications';

export class MockEmailService {
  private deliveries: MockEmailDelivery[] = [];
  private failureRate: number = 0;
  private deliveryDelay: number = 100; // ms

  constructor(options: { failureRate?: number; deliveryDelay?: number } = {}) {
    this.failureRate = options.failureRate || 0;
    this.deliveryDelay = options.deliveryDelay || 100;
  }

  async sendEmail(
    to: string[],
    subject: string,
    htmlBody: string,
    textBody: string
  ): Promise<MockEmailDelivery> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, this.deliveryDelay));

    const shouldFail = Math.random() < this.failureRate;
    
    const delivery: MockEmailDelivery = {
      to,
      subject,
      html_body: htmlBody,
      text_body: textBody,
      delivered: !shouldFail,
      bounce_reason: shouldFail ? 'Simulated delivery failure' : undefined
    };

    this.deliveries.push(delivery);
    return delivery;
  }

  async sendNotificationEmail(event: NotificationEvent, recipients: string[]): Promise<MockEmailDelivery> {
    const subject = `[${event.severity.toUpperCase()}] ${event.title}`;
    const htmlBody = this.generateHtmlEmail(event);
    const textBody = this.generateTextEmail(event);

    return this.sendEmail(recipients, subject, htmlBody, textBody);
  }

  private generateHtmlEmail(event: NotificationEvent): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: ${this.getSeverityColor(event.severity)}; color: white; padding: 16px;">
            <h1>${event.title}</h1>
            <p><strong>Severity:</strong> ${event.severity.toUpperCase()}</p>
            <p><strong>Time:</strong> ${event.timestamp}</p>
          </div>
          <div style="padding: 16px;">
            <p>${event.message}</p>
            ${event.context.repository ? `
              <div style="background-color: #f5f5f5; padding: 12px; margin: 16px 0;">
                <h3>Repository Information</h3>
                <p><strong>Repository:</strong> <a href="${event.context.repository.url}">${event.context.repository.name}</a></p>
                <p><strong>Owner:</strong> ${event.context.repository.owner}</p>
              </div>
            ` : ''}
            ${event.context.security_finding ? `
              <div style="background-color: #fef2f2; padding: 12px; margin: 16px 0; border-left: 4px solid #dc2626;">
                <h3>Security Finding Details</h3>
                <p><strong>Rule:</strong> ${event.context.security_finding.rule_id}</p>
                <p><strong>File:</strong> ${event.context.security_finding.file_path}</p>
                ${event.context.security_finding.line_number ? `<p><strong>Line:</strong> ${event.context.security_finding.line_number}</p>` : ''}
              </div>
            ` : ''}
          </div>
        </body>
      </html>
    `;
  }

  private generateTextEmail(event: NotificationEvent): string {
    let text = `${event.title}\n`;
    text += `${'='.repeat(event.title.length)}\n\n`;
    text += `Severity: ${event.severity.toUpperCase()}\n`;
    text += `Time: ${event.timestamp}\n\n`;
    text += `${event.message}\n\n`;

    if (event.context.repository) {
      text += `Repository: ${event.context.repository.name}\n`;
      text += `Owner: ${event.context.repository.owner}\n`;
      text += `URL: ${event.context.repository.url}\n\n`;
    }

    if (event.context.security_finding) {
      text += `Security Finding:\n`;
      text += `  Rule: ${event.context.security_finding.rule_id}\n`;
      text += `  File: ${event.context.security_finding.file_path}\n`;
      if (event.context.security_finding.line_number) {
        text += `  Line: ${event.context.security_finding.line_number}\n`;
      }
    }

    return text;
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#d97706';
      case 'low': return '#059669';
      default: return '#6b7280';
    }
  }

  getDeliveries(): MockEmailDelivery[] {
    return [...this.deliveries];
  }

  clearDeliveries(): void {
    this.deliveries = [];
  }

  getDeliveryCount(): number {
    return this.deliveries.length;
  }

  getSuccessfulDeliveries(): MockEmailDelivery[] {
    return this.deliveries.filter(d => d.delivered);
  }

  getFailedDeliveries(): MockEmailDelivery[] {
    return this.deliveries.filter(d => !d.delivered);
  }
}