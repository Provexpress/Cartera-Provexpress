import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AgingSummaryItem, CustomerSummary, GroupSummary } from '../types';
import { formatCompactCurrency, formatCurrency, formatPercent } from '../lib/carteraApi';

interface Props {
  agingItems: AgingSummaryItem[];
  groups: GroupSummary[];
  customers: CustomerSummary[];
}

export function CarteraCharts({ agingItems, groups, customers }: Props) {
  const agingChartData = agingItems.map((item) => ({
    name: item.shortLabel,
    fullName: item.label,
    monto: item.totalValor,
    docs: item.count,
    color: item.color,
  }));

  const pieData = agingItems
    .filter((item) => item.totalValor > 0)
    .map((item) => ({
      name: item.shortLabel,
      value: item.totalValor,
      color: item.color,
    }));

  const groupChartData = groups.map((g) => ({
    name: g.grupoNombre.replace('Grupo ', 'G. '),
    corriente: g.totalCorriente,
    vencido: g.totalVencido,
    total: g.totalSaldo,
  }));

  const top10Customers = customers.slice(0, 8).map((c) => ({
    name: c.empresa.length > 20 ? `${c.empresa.substring(0, 19)}…` : c.empresa,
    fullName: c.empresa,
    nit: c.nit,
    saldo: c.totalSaldo,
    vencido: c.totalVencido,
  }));

  return (
    <div className="charts-dashboard-grid">
      {/* 1. Gráfico de Barras: Distribución de Cartera por Edades */}
      <div className="chart-card">
        <div className="chart-card-header">
          <div>
            <h3>Distribución por Edades de Vencimiento</h3>
            <span className="chart-card-sub">Montos acumulados según días de vencimiento</span>
          </div>
        </div>
        <div className="chart-body" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={agingChartData} margin={{ top: 15, right: 15, left: 15, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#4b5563' }} />
              <YAxis
                tickFormatter={(val) => formatCompactCurrency(val)}
                tick={{ fontSize: 11, fill: '#6b7280' }}
              />
              <Tooltip
                formatter={(val: any) => [formatCurrency(Number(val)), 'Saldo Total']}
                labelFormatter={(label) => {
                  const found = agingChartData.find((d) => d.name === label);
                  return found ? `${found.fullName} (${found.docs} docs)` : label;
                }}
                contentStyle={{
                  borderRadius: 12,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  border: 'none',
                }}
              />
              <Bar dataKey="monto" radius={[6, 6, 0, 0]}>
                {agingChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Gráfico Donut: Proporción de Cartera */}
      <div className="chart-card">
        <div className="chart-card-header">
          <div>
            <h3>Composición de Vencimientos</h3>
            <span className="chart-card-sub">Participación porcentual en el portafolio</span>
          </div>
        </div>
        <div className="chart-body" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={3}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`pie-cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(val: any) => [formatCurrency(Number(val)), 'Saldo']}
                contentStyle={{
                  borderRadius: 12,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  border: 'none',
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => <span style={{ fontSize: 12, color: '#374151' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Gráfico por Grupos Comerciales */}
      <div className="chart-card">
        <div className="chart-card-header">
          <div>
            <h3>Cartera por Grupos Comerciales</h3>
            <span className="chart-card-sub">Comparación de saldo corriente vs vencido</span>
          </div>
        </div>
        <div className="chart-body" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={groupChartData} margin={{ top: 15, right: 15, left: 15, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#4b5563' }} />
              <YAxis
                tickFormatter={(val) => formatCompactCurrency(val)}
                tick={{ fontSize: 11, fill: '#6b7280' }}
              />
              <Tooltip
                formatter={(val: any) => [formatCurrency(Number(val))]}
                contentStyle={{
                  borderRadius: 12,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  border: 'none',
                }}
              />
              <Legend verticalAlign="bottom" height={36} />
              <Bar dataKey="corriente" name="Corriente (Al día)" fill="#18a957" radius={[4, 4, 0, 0]} stackId="a" />
              <Bar dataKey="vencido" name="Vencido" fill="#e63030" radius={[4, 4, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Top Clientes con Mayor Saldo */}
      <div className="chart-card">
        <div className="chart-card-header">
          <div>
            <h3>Top Clientes con Mayor Saldo</h3>
            <span className="chart-card-sub">Principales deudores en el portafolio</span>
          </div>
        </div>
        <div className="chart-body" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={top10Customers}
              layout="vertical"
              margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
              <XAxis
                type="number"
                tickFormatter={(val) => formatCompactCurrency(val)}
                tick={{ fontSize: 11, fill: '#6b7280' }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 11, fill: '#374151' }}
              />
              <Tooltip
                formatter={(val: any) => [formatCurrency(Number(val)), 'Saldo Total']}
                labelFormatter={(label) => {
                  const c = top10Customers.find((item) => item.name === label);
                  return c ? `${c.fullName} (NIT: ${c.nit})` : label;
                }}
                contentStyle={{
                  borderRadius: 12,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  border: 'none',
                }}
              />
              <Bar dataKey="saldo" name="Saldo Total" fill="#0071e3" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
