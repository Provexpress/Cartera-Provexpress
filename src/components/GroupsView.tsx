import { useState } from 'react';
import { ChevronDown, ChevronUp, DollarSign, Filter, Mail, Users, Building, ShieldAlert, CheckCircle } from 'lucide-react';
import type { ExecutiveSummary, GroupSummary } from '../types';
import { formatCompactCurrency, formatCurrency, formatNumber, formatPercent } from '../lib/carteraApi';

interface Props {
  groups: GroupSummary[];
  executives: ExecutiveSummary[];
  onFilterGroup: (grupo: number) => void;
  onFilterExecutive: (name: string) => void;
  onOpenEmailModal: (group?: GroupSummary, executive?: ExecutiveSummary) => void;
}

export function GroupsView({
  groups,
  executives,
  onFilterGroup,
  onFilterExecutive,
  onOpenEmailModal,
}: Props) {
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
  });

  const toggleGroup = (grupo: number) => {
    setExpandedGroups((prev) => ({ ...prev, [grupo]: !prev[grupo] }));
  };

  return (
    <div className="groups-view-container">
      <div className="view-header-strip">
        <div>
          <h2>Estructura Comercial y Grupos de Cartera</h2>
          <p>
            Supervisión consolidada por directores y fuerza de ventas corporativa Provexpress SAS.
          </p>
        </div>
      </div>

      <div className="groups-grid">
        {groups.map((grp) => {
          const isExpanded = !!expandedGroups[grp.grupo];
          const grpExecs = executives.filter((e) => e.grupo === grp.grupo);

          return (
            <div key={grp.grupo} className="group-card">
              {/* Encabezado del Grupo */}
              <div className="group-card-header">
                <div className="group-header-left">
                  <div className="group-badge-icon">
                    <Building size={20} />
                  </div>
                  <div>
                    <div className="group-title-row">
                      <h3>{grp.grupoNombre}</h3>
                      <span className={`badge ${grp.porcentajeVencido > 40 ? 'badge-danger' : grp.porcentajeVencido > 20 ? 'badge-warning' : 'badge-success'}`}>
                        {formatPercent(grp.porcentajeVencido)} vencida
                      </span>
                    </div>
                    <span className="group-director-label">
                      Director: <strong>{grp.directorNombre}</strong>
                    </span>
                  </div>
                </div>

                <div className="group-header-actions">
                  <button
                    type="button"
                    className="button button-sm button-secondary"
                    onClick={() => onFilterGroup(grp.grupo)}
                    title="Filtrar todas las facturas de este grupo"
                  >
                    <Filter size={14} />
                    <span>Ver Facturas</span>
                  </button>
                  <button
                    type="button"
                    className="button button-sm button-primary"
                    onClick={() => onOpenEmailModal(grp)}
                    title="Enviar estado de cartera a este director por correo M365"
                  >
                    <Mail size={14} />
                    <span>Notificar</span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => toggleGroup(grp.grupo)}
                    aria-label={isExpanded ? 'Contraer' : 'Expandir'}
                  >
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </div>

              {/* Métricas Principales del Grupo */}
              <div className="group-metrics-row">
                <div className="group-metric">
                  <span className="lbl">Saldo Total Grupo</span>
                  <strong className="val">{formatCurrency(grp.totalSaldo)}</strong>
                  <span className="sub">{formatNumber(grp.docCount)} facturas activas</span>
                </div>

                <div className="group-metric green">
                  <span className="lbl">Corriente (Al día)</span>
                  <strong className="val green">{formatCurrency(grp.totalCorriente)}</strong>
                  <span className="sub">
                    {formatPercent(grp.totalSaldo > 0 ? (grp.totalCorriente / grp.totalSaldo) * 100 : 0)} del grupo
                  </span>
                </div>

                <div className="group-metric red">
                  <span className="lbl">Cartera Vencida</span>
                  <strong className="val red">{formatCurrency(grp.totalVencido)}</strong>
                  <span className="sub">{grp.clientesCount} clientes con saldo</span>
                </div>
              </div>

              {/* Barra de progreso de cartera del grupo */}
              <div className="group-balance-bar-wrap">
                <div className="group-bar-track">
                  <div
                    className="group-bar-fill green"
                    style={{
                      width: `${grp.totalSaldo > 0 ? (grp.totalCorriente / grp.totalSaldo) * 100 : 0}%`,
                    }}
                    title={`Corriente: ${formatCurrency(grp.totalCorriente)}`}
                  />
                  <div
                    className="group-bar-fill red"
                    style={{
                      width: `${grp.totalSaldo > 0 ? (grp.totalVencido / grp.totalSaldo) * 100 : 0}%`,
                    }}
                    title={`Vencido: ${formatCurrency(grp.totalVencido)}`}
                  />
                </div>
              </div>

              {/* Acordeón de Ejecutivos / Vendedores del Grupo */}
              {isExpanded && (
                <div className="group-execs-section">
                  <div className="execs-title">
                    <Users size={14} />
                    <span>Fuerza de Ventas ({grpExecs.length} Ejecutivos)</span>
                  </div>

                  <div className="execs-table-container">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Ejecutivo Comercial</th>
                          <th style={{ textAlign: 'right' }}>Saldo Total</th>
                          <th style={{ textAlign: 'right' }}>Corriente</th>
                          <th style={{ textAlign: 'right' }}>Vencido</th>
                          <th style={{ textAlign: 'center' }}>% Vencido</th>
                          <th style={{ textAlign: 'center' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grpExecs.map((exec) => (
                          <tr key={exec.nombre}>
                            <td>
                              <div className="exec-name-cell">
                                <strong>{exec.nombre}</strong>
                                <span className="exec-docs-hint">{exec.docCount} facturas</span>
                              </div>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              {formatCurrency(exec.totalSaldo)}
                            </td>
                            <td style={{ textAlign: 'right', color: '#16a34a' }}>
                              {formatCurrency(exec.totalCorriente)}
                            </td>
                            <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>
                              {formatCurrency(exec.totalVencido)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`badge-pill ${exec.porcentajeVencido > 40 ? 'pill-danger' : exec.porcentajeVencido > 20 ? 'pill-warning' : 'pill-success'}`}>
                                {formatPercent(exec.porcentajeVencido)}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div className="row-action-btns">
                                <button
                                  type="button"
                                  className="btn-link"
                                  onClick={() => onFilterExecutive(exec.nombre)}
                                  title="Filtrar facturas de este ejecutivo"
                                >
                                  Ver detalle
                                </button>
                                <button
                                  type="button"
                                  className="btn-icon-link"
                                  onClick={() => onOpenEmailModal(grp, exec)}
                                  title="Enviar correo de cartera a este ejecutivo"
                                >
                                  <Mail size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
