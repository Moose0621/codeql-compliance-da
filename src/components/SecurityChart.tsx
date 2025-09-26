import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import type { SecurityFindings } from "@/types/dashboard";

interface SecurityChartProps {
  findings: SecurityFindings[];
  title?: string;
}

export function SecurityChart({ findings, title = "Security Findings Overview" }: SecurityChartProps) {
  const aggregateFindings = findings.reduce((acc, finding) => ({
    critical: acc.critical + finding.critical,
    high: acc.high + finding.high,
    medium: acc.medium + finding.medium,
    low: acc.low + finding.low,
    note: acc.note + finding.note,
    total: acc.total + finding.total
  }), {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    note: 0,
    total: 0
  });

  const formatFindingCount = (count: number, label: string) => {
    if (count === 0) return '';
    return `${count} ${label}${count === 1 ? '' : 's'}`;
  };

  const pieChartLabel = [
    'Security findings pie chart showing',
    `${aggregateFindings.total} total ${aggregateFindings.total === 1 ? 'finding' : 'findings'}:`,
    formatFindingCount(aggregateFindings.critical, 'critical'),
    formatFindingCount(aggregateFindings.high, 'high'), 
    formatFindingCount(aggregateFindings.medium, 'medium'),
    formatFindingCount(aggregateFindings.low, 'low'),
    formatFindingCount(aggregateFindings.note, 'note')
  ].filter(Boolean).join(' ');

  const barChartLabel = [
    'Security findings bar chart showing counts by severity:',
    formatFindingCount(aggregateFindings.critical, 'Critical'),
    formatFindingCount(aggregateFindings.high, 'High'),
    formatFindingCount(aggregateFindings.medium, 'Medium'), 
    formatFindingCount(aggregateFindings.low, 'Low'),
    formatFindingCount(aggregateFindings.note, 'Note')
  ].filter(Boolean).join(' ');

  const pieData = [
    { name: 'Critical', value: aggregateFindings.critical, color: '#dc2626' },
    { name: 'High', value: aggregateFindings.high, color: '#ea580c' },
    { name: 'Medium', value: aggregateFindings.medium, color: '#d97706' },
    { name: 'Low', value: aggregateFindings.low, color: '#2563eb' },
    { name: 'Note', value: aggregateFindings.note, color: '#6b7280' }
  ].filter(item => item.value > 0);

  const barData = [
    { severity: 'Critical', count: aggregateFindings.critical, fill: '#dc2626' },
    { severity: 'High', count: aggregateFindings.high, fill: '#ea580c' },
    { severity: 'Medium', count: aggregateFindings.medium, fill: '#d97706' },
    { severity: 'Low', count: aggregateFindings.low, fill: '#2563eb' },
    { severity: 'Note', count: aggregateFindings.note, fill: '#6b7280' }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Severity Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {aggregateFindings.total > 0 ? (
            <div role="img" aria-label={pieChartLabel}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} findings`, 'Count']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground" role="status" aria-label="No security findings to display">
              No security findings
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Finding Counts</CardTitle>
        </CardHeader>
        <CardContent>
          <div role="img" aria-label={barChartLabel}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData}>
                <XAxis dataKey="severity" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value} findings`, 'Count']} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}