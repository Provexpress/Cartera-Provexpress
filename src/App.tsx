import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Building,
  Calendar,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  Download,
  Filter,
  Layers,
  LayoutDashboard,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  Percent,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import type {
  AgeBucketKey,
  AgingSummaryItem,
  CarteraDataState,
  CarteraRecord,
  CustomerSummary,
  ExecutiveSummary,
  GroupSummary,
  UserProfile,
} from './types';
import {
  AGING_CONFIG,
  computeCarteraMetrics,
  fetchCarteraCompleta,
  formatCompactCurrency,
  formatCurrency,
  formatNumber,
  formatPercent,
  getDefaultDateRange,
} from './lib/carteraApi';
import { getExistingProfile, signIn, signOut } from './lib/auth';
import { LISTA_DIRECTORES } from './lib/commercialDirectory';
import { downloadBufferAsFile, generateCarteraExcel } from './lib/excelGenerator';
import { AgingCards } from './components/AgingCards';
import { CarteraCharts } from './components/CarteraCharts';
import { CarteraTable } from './components/CarteraTable';
import { GroupsView } from './components/GroupsView';
import { RecibosCajaView } from './components/RecibosCajaView';
import { NotasCreditoView } from './components/NotasCreditoView';
import { GestionDiaADiaView } from './components/GestionDiaADiaView';
import { InvoiceDetailModal } from './components/InvoiceDetailModal';
import { EmailNotificationModal } from './components/EmailNotificationModal';

type ViewMode = 'dashboard' | 'gestion' | 'facturas' | 'grupos' | 'recibos' | 'notas';
type DatePreset = 'today' | 'current_month' | 'last_month' | 'custom';

const AGING_ORDER: AgeBucketKey[] = [
  'CORRIENTE',
  '1_30',
  '31_60',
  '61_90',
  '91_120',
  '121_180',
  'MAS_180',
];

export function App() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);

  // Fechas y presets
  const defaults = useMemo(() => getDefaultDateRange(), []);
  const [fechaInicial, setFechaInicial] = useState<string>(defaults.fechaInicial);
  const [fechaFinal, setFechaFinal] = useState<string>(defaults.fechaFinal);
  const [datePreset, setDatePreset] = useState<DatePreset>('current_month');

  // Datos del backend
  const [carteraData, setCarteraData] = useState<CarteraDataState | null>(null);

  // Navegación
  const [view, setView] = useState<ViewMode>('dashboard');

  // Filtros interactivos
  const [selectedAging, setSelectedAging] = useState<AgeBucketKey | 'all'>('all');
  const [selectedGrupo, setSelectedGrupo] = useState<number | 'all'>('all');
  const [selectedDirector, setSelectedDirector] = useState<string | 'all'>('all');
  const [selectedExecutive, setSelectedExecutive] = useState<string | 'all'>('all');
  const [selectedEstado, setSelectedEstado] = useState<string | 'all'>('all');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  // Modales
  const [selectedInvoice, setSelectedInvoice] = useState<CarteraRecord | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailTargetGroup, setEmailTargetGroup] = useState<GroupSummary | undefined>();
  const [emailTargetExec, setEmailTargetExec] = useState<ExecutiveSummary | undefined>();

  // Carga inicial de sesión M365 (segura, no bloquea si no está disponible)
  useEffect(() => {
    getExistingProfile()
      .then((p) => {
        if (p) setUser(p);
      })
      .catch((err) => console.log('Sin sesión previa M365:', err));
  }, []);

  // Función principal de carga de datos
  const loadData = async (isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const data = await fetchCarteraCompleta(fechaInicial, fechaFinal);
      setCarteraData(data);
    } catch (err: any) {
      console.error('Error al cargar datos de cartera:', err);
      setError(err.message || 'Error de conexión con el backend de Cartera ERP.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [fechaInicial, fechaFinal]);

  // Manejo de cambio de Presets de Fecha
  const handleSelectPreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');

    if (preset === 'today') {
      const todayStr = `${y}-${m}-${d}`;
      setFechaInicial(todayStr);
      setFechaFinal(todayStr);
    } else if (preset === 'current_month') {
      setFechaInicial(`${y}-${m}-01`);
      setFechaFinal(`${y}-${m}-${d}`);
    } else if (preset === 'last_month') {
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      const lmYear = lastMonthDate.getFullYear();
      const lmM = String(lastMonthDate.getMonth() + 1).padStart(2, '0');
      const lmLastD = String(lastMonthLastDay.getDate()).padStart(2, '0');
      setFechaInicial(`${lmYear}-${lmM}-01`);
      setFechaFinal(`${lmYear}-${lmM}-${lmLastD}`);
    }
  };

  // ─── CÁLCULO DINÁMICO Y REACTIVO DE MÉTRICAS FILTRADAS ─────────────────────
  // Se filtran los datos según Grupo, Director, Ejecutivo, Estado y Solo Vencidas
  const filteredMetrics = useMemo(() => {
    if (!carteraData) return null;

    let baseList = carteraData.records;

    if (selectedGrupo !== 'all') {
      baseList = baseList.filter((r) => r.grupoNumero === selectedGrupo);
    }
    if (selectedDirector !== 'all') {
      baseList = baseList.filter(
        (r) => r.directorNombre.toLowerCase() === selectedDirector.toLowerCase()
      );
    }
    if (selectedExecutive !== 'all') {
      baseList = baseList.filter(
        (r) => r.Nombre_Empleado.toLowerCase() === selectedExecutive.toLowerCase()
      );
    }
    if (selectedEstado !== 'all') {
      baseList = baseList.filter(
        (r) => r.Estado_Cliente.toLowerCase() === selectedEstado.toLowerCase()
      );
    }
    if (onlyOverdue) {
      baseList = baseList.filter((r) => r.estaVencida);
    }

    const metrics = computeCarteraMetrics(baseList);

    return {
      baseList,
      totalSaldo: metrics.totalSaldo,
      totalCorriente: metrics.totalCorriente,
      totalVencido: metrics.totalVencido,
      porcentajeVencido: metrics.porcentajeVencido,
      totalDocumentos: metrics.totalDocumentos,
      clientesUnicos: metrics.clientesUnicos,
      agingItems: metrics.agingBreakdown,
      groups: metrics.groupsSummary,
      executives: metrics.executivesSummary,
      customers: metrics.customersSummary,
    };
  }, [
    carteraData,
    selectedGrupo,
    selectedDirector,
    selectedExecutive,
    selectedEstado,
    onlyOverdue,
  ]);

  // Lista de facturas filtradas incluyendo la tarjeta de edad seleccionada
  const filteredRecords = useMemo(() => {
    if (!filteredMetrics) return [];
    if (selectedAging === 'all') return filteredMetrics.baseList;
    return filteredMetrics.baseList.filter((r) => r.categoriaEdad === selectedAging);
  }, [filteredMetrics, selectedAging]);

  // Recibos de caja filtrados reactivamente según grupo comercial y director
  const filteredRecibos = useMemo(() => {
    if (!carteraData) return [];
    let list = carteraData.recibos;
    if (selectedGrupo !== 'all') {
      list = list.filter((r) => r.grupoNumero === selectedGrupo);
    }
    if (selectedDirector !== 'all') {
      list = list.filter(
        (r) => (r.directorNombre || '').toLowerCase() === selectedDirector.toLowerCase()
      );
    }
    return list;
  }, [carteraData, selectedGrupo, selectedDirector]);

  // Notas crédito filtradas reactivamente según grupo comercial y director
  const filteredNotas = useMemo(() => {
    if (!carteraData) return [];
    let list = carteraData.notas;
    if (selectedGrupo !== 'all') {
      list = list.filter((n) => n.grupoNumero === selectedGrupo);
    }
    if (selectedDirector !== 'all') {
      list = list.filter(
        (n) => (n.directorNombre || '').toLowerCase() === selectedDirector.toLowerCase()
      );
    }
    return list;
  }, [carteraData, selectedGrupo, selectedDirector]);

    // Lista de ejecutivos disponibles según el grupo seleccionado
  const availableExecutives = useMemo(() => {
    if (!carteraData) return [];
    const set = new Set<string>();
    carteraData.records.forEach((r) => {
      if (selectedGrupo !== 'all' && r.grupoNumero !== selectedGrupo) return;
      if (r.Nombre_Empleado) set.add(r.Nombre_Empleado);
    });
    return Array.from(set).sort();
  }, [carteraData, selectedGrupo]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedAging !== 'all') count++;
    if (selectedGrupo !== 'all') count++;
    if (selectedDirector !== 'all') count++;
    if (selectedExecutive !== 'all') count++;
    if (selectedEstado !== 'all') count++;
    if (onlyOverdue) count++;
    return count;
  }, [
    selectedAging,
    selectedGrupo,
    selectedDirector,
    selectedExecutive,
    selectedEstado,
    onlyOverdue,
  ]);

  const clearAllFilters = () => {
    setSelectedAging('all');
    setSelectedGrupo('all');
    setSelectedDirector('all');
    setSelectedExecutive('all');
    setSelectedEstado('all');
    setOnlyOverdue(false);
  };

  // Descarga rápida de Excel
  const handleExportExcel = async () => {
    if (!carteraData) return;
    try {
      const res = await generateCarteraExcel(carteraData, filteredRecords);
      downloadBufferAsFile(res.buffer, res.filename);
    } catch (err: any) {
      alert(`Error al generar Excel: ${err.message}`);
    }
  };

  // Abrir modal de correo
  const handleOpenEmailModal = (group?: GroupSummary, exec?: ExecutiveSummary) => {
    setEmailTargetGroup(group);
    setEmailTargetExec(exec);
    setEmailModalOpen(true);
  };

  // Manejo de Login M365
  const handleLogin = async () => {
    try {
      const p = await signIn();
      setUser(p);
    } catch (err: any) {
      alert(`Error al autenticar con Microsoft 365: ${err.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setUser(null);
    } catch (err: any) {
      console.error(err);
    }
  };

  if (loading && !carteraData) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <img src="/logo-provexpress.png" alt="Provexpress" />
          <div className="loading-icon">
            <Loader2 size={28} />
          </div>
          <h2>Conectando con Cartera ERP</h2>
          <p>Consultando edades, facturas y recaudos en tiempo real…</p>
          <div className="loading-track">
            <span />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* 1. TOPBAR FIJA CON ESTILO APPLE */}
      <header className="topbar">
        <div className="topbar-inner">
          <div className="app-brand">
            <img src="/logo-provexpress.png" alt="Provexpress" />
            <div className="app-divider" />
            <div>
              <strong>Cartera & Edades</strong>
              <span style={{ fontSize: 11, color: '#6e6e73' }}>Provexpress S.A.S.</span>
            </div>
          </div>

          {/* Rango de Fechas y Presets */}
          <div className="topbar-controls" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="date-presets-wrap" style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                className={`preset-chip ${datePreset === 'today' ? 'active' : ''}`}
                onClick={() => handleSelectPreset('today')}
              >
                Hoy
              </button>
              <button
                type="button"
                className={`preset-chip ${datePreset === 'current_month' ? 'active' : ''}`}
                onClick={() => handleSelectPreset('current_month')}
              >
                Mes Actual
              </button>
              <button
                type="button"
                className={`preset-chip ${datePreset === 'last_month' ? 'active' : ''}`}
                onClick={() => handleSelectPreset('last_month')}
              >
                Mes Anterior
              </button>
            </div>

            <div className="date-inputs-wrap" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="date"
                className="date-input-field"
                value={fechaInicial}
                onChange={(e) => {
                  setFechaInicial(e.target.value);
                  setDatePreset('custom');
                }}
              />
              <span style={{ color: '#8e8e93', fontSize: 12 }}>a</span>
              <input
                type="date"
                className="date-input-field"
                value={fechaFinal}
                onChange={(e) => {
                  setFechaFinal(e.target.value);
                  setDatePreset('custom');
                }}
              />
            </div>

            <button
              type="button"
              className="button button-sm button-secondary"
              onClick={() => void loadData(true)}
              disabled={refreshing}
              title="Sincronizar datos con el ERP"
            >
              <RefreshCw size={13} className={refreshing ? 'spinner' : ''} />
              <span>{refreshing ? 'Actualizando...' : 'Actualizar'}</span>
            </button>
          </div>

          {/* Acciones Rápidas y Usuario */}
          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="button button-sm button-secondary"
              onClick={handleExportExcel}
              title="Descargar libro Excel con todas las hojas"
            >
              <Download size={13} />
              <span>Excel</span>
            </button>

            <button
              type="button"
              className="button button-sm button-primary"
              onClick={() => handleOpenEmailModal()}
              title="Enviar resumen por Microsoft 365"
            >
              <Mail size={13} />
              <span>Notificar M365</span>
            </button>

            {user ? (
              <div className="user-profile-badge" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="user-avatar-circle" title={user.email}>
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <span className="user-display-name" style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {user.name.split(' ')[0]}
                </span>
                <button
                  type="button"
                  className="icon-btn-minimal"
                  onClick={handleLogout}
                  title="Cerrar sesión M365"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="button button-sm button-secondary"
                onClick={handleLogin}
                title="Conectar cuenta Microsoft 365"
              >
                <LogIn size={13} />
                <span>M365</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. HERO BANNER Y NAVEGACIÓN SEGMENTADA APPLE */}
      <main className="content-container" style={{ width: 'min(1560px, calc(100% - 32px))', margin: '24px auto' }}>
        {error && (
          <div className="welcome-error" style={{ marginBottom: 20 }}>
            <ShieldAlert size={20} />
            <div>
              <strong>Error en la consulta:</strong>
              <span>{error}</span>
            </div>
            <button
              type="button"
              className="button button-sm button-secondary"
              onClick={() => void loadData()}
              style={{ marginLeft: 'auto' }}
            >
              Reintentar
            </button>
          </div>
        )}

        <div className="hero-banner" style={{ marginBottom: 20 }}>
          <div className="hero-left">
            <div className="eyebrow blue">
              <Zap size={15} /> Provexpress Cartera · Corte al {fechaFinal}
            </div>
            <h1 style={{ fontSize: 32, margin: '10px 0 6px', fontWeight: 800, letterSpacing: '-0.04em' }}>
              {view === 'dashboard'
                ? 'Tablero General de Edades'
                : view === 'gestion'
                ? 'Gestión de Cartera Día a Día'
                : view === 'facturas'
                ? 'Detalle de Facturas y Saldos'
                : view === 'grupos'
                ? 'Grupos Comerciales y Directores'
                : view === 'recibos'
                ? 'Recibos de Caja y Recaudos'
                : 'Notas Crédito y Ajustes'}
            </h1>
            <p style={{ margin: 0, color: '#6e6e73', fontSize: 14 }}>
              {view === 'gestion'
                ? 'Seguimiento de facturas saldadas/matadas por Recibos de Caja desde el corte base del 06 de octubre de 2026.'
                : 'Seguimiento integral de cuentas por cobrar, vencimientos, cupos y gestión comercial en tiempo real.'}
            </p>
          </div>

          {/* BOTONES DE VISTA: SEGMENTED NAV ESTILO REMISIONES (APPLE MAC OS) */}
          <nav className="segmented-nav" aria-label="Vistas del sistema" style={{ marginTop: 18, alignSelf: 'flex-start' }}>
            <button
              type="button"
              className={view === 'dashboard' ? 'active' : ''}
              onClick={() => setView('dashboard')}
              title="Resumen ejecutivo y edades de cartera"
            >
              <LayoutDashboard size={15} />
              <span>Tablero & Edades</span>
            </button>

            <button
              type="button"
              className={view === 'gestion' ? 'active' : ''}
              onClick={() => setView('gestion')}
              title="Gestión operativa día a día desde 06/10: Facturas matadas por recibos de caja"
            >
              <CalendarRange size={15} />
              <span>Gestión Día a Día</span>
              <span className="nav-tab-badge green">Desde 06/10</span>
            </button>

            <button
              type="button"
              className={view === 'facturas' ? 'active' : ''}
              onClick={() => setView('facturas')}
              title="Lista detallada de facturas abiertas"
            >
              <Layers size={15} />
              <span>Facturas</span>
              <span className="nav-tab-badge blue">
                {formatNumber(filteredRecords.length)}
              </span>
            </button>

            <button
              type="button"
              className={view === 'grupos' ? 'active' : ''}
              onClick={() => setView('grupos')}
              title="Supervisión por grupos y directores comerciales"
            >
              <Building size={15} />
              <span>Grupos Comerciales</span>
            </button>

            <button
              type="button"
              className={view === 'recibos' ? 'active' : ''}
              onClick={() => setView('recibos')}
              title="Recibos de caja y comprobantes de recaudo"
            >
              <CheckCircle2 size={15} />
              <span>Recibos de Caja</span>
              <span className="nav-tab-badge green">
                {formatNumber(filteredRecibos.length)}
              </span>
            </button>

            <button
              type="button"
              className={view === 'notas' ? 'active' : ''}
              onClick={() => setView('notas')}
              title="Notas crédito del período"
            >
              <Percent size={15} />
              <span>Notas Crédito</span>
              <span className="nav-tab-badge purple">
                {formatNumber(filteredNotas.length)}
              </span>
            </button>
          </nav>
        </div>

        {/* 3. BARRA DE FILTROS SUPERIOR (REACTIVA) */}
        <section className="filter-bar" style={{ marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="filter-field">
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6e6e73', textTransform: 'uppercase' }}>
              Grupo Comercial
            </label>
            <select
              className="select-input"
              value={selectedGrupo}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                setSelectedGrupo(val);
                setSelectedExecutive('all');
              }}
            >
              <option value="all">Todos los Grupos</option>
              <option value="1">Grupo 1 (Rafael Novoa)</option>
              <option value="2">Grupo 2 (Angélica Caballero)</option>
              <option value="3">Grupo 3 (Óscar Beltrán)</option>
              <option value="4">Grupo 4 (Miller Romero)</option>
              <option value="0">Gerencia / Especiales</option>
            </select>
          </div>

          <div className="filter-field">
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6e6e73', textTransform: 'uppercase' }}>
              Director Comercial
            </label>
            <select
              className="select-input"
              value={selectedDirector}
              onChange={(e) => setSelectedDirector(e.target.value)}
            >
              <option value="all">Todos los Directores</option>
              {LISTA_DIRECTORES.map((d) => (
                <option key={d.email} value={d.nombre}>
                  {d.nombre} (Grupo {d.grupo})
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6e6e73', textTransform: 'uppercase' }}>
              Ejecutivo / Vendedor
            </label>
            <select
              className="select-input"
              value={selectedExecutive}
              onChange={(e) => setSelectedExecutive(e.target.value)}
            >
              <option value="all">Todos los Ejecutivos</option>
              {availableExecutives.map((exec) => (
                <option key={exec} value={exec}>
                  {exec}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6e6e73', textTransform: 'uppercase' }}>
              Estado Cliente
            </label>
            <select
              className="select-input"
              value={selectedEstado}
              onChange={(e) => setSelectedEstado(e.target.value)}
            >
              <option value="all">Todos los Estados</option>
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
              <option value="Bloqueado">Bloqueado</option>
            </select>
          </div>

          <div className="filter-field checkbox-field" style={{ alignSelf: 'flex-end', paddingBottom: 6 }}>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={onlyOverdue}
                onChange={(e) => setOnlyOverdue(e.target.checked)}
              />
              <span style={{ fontWeight: 600, color: '#b91c1c' }}>Solo Cartera Vencida</span>
            </label>
          </div>

          {activeFiltersCount > 0 && (
            <button
              type="button"
              className="clear-filters-btn"
              onClick={clearAllFilters}
              style={{ alignSelf: 'flex-end', marginBottom: 6 }}
            >
              Limpiar filtros ({activeFiltersCount})
            </button>
          )}
        </section>

        {/* 4. CONTENIDO SEGÚN LA VISTA SELECCIONADA */}
        {carteraData && filteredMetrics && (
          <>
            {/* VISTA 1: TABLERO & EDADES (REACTIVO CON filteredMetrics) */}
            {view === 'dashboard' && (
              <>
                <AgingCards
                  totalSaldo={filteredMetrics.totalSaldo}
                  totalCorriente={filteredMetrics.totalCorriente}
                  totalVencido={filteredMetrics.totalVencido}
                  porcentajeVencido={filteredMetrics.porcentajeVencido}
                  totalDocumentos={filteredMetrics.totalDocumentos}
                  clientesUnicos={filteredMetrics.clientesUnicos}
                  agingItems={filteredMetrics.agingItems}
                  selectedAging={selectedAging}
                  onSelectAging={setSelectedAging}
                />

                <CarteraCharts
                  agingItems={filteredMetrics.agingItems}
                  groups={filteredMetrics.groups}
                  customers={filteredMetrics.customers}
                />

                <div className="dashboard-subtable-section" style={{ marginTop: 24 }}>
                  <div className="subtable-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 750 }}>
                      Facturas Filtradas ({formatNumber(filteredRecords.length)})
                    </h3>
                    <button
                      type="button"
                      className="button button-sm button-secondary"
                      onClick={() => setView('facturas')}
                    >
                      Ver Tabla Completa
                    </button>
                  </div>
                  <CarteraTable
                    records={filteredRecords}
                    onSelectRecord={setSelectedInvoice}
                    onExportExcel={handleExportExcel}
                  />
                </div>
              </>
            )}

            {/* VISTA 2: GESTIÓN OPERATIVA DÍA A DÍA (BASE 06/10) */}
            {view === 'gestion' && (
              <GestionDiaADiaView
                records={filteredRecords}
                recibos={filteredRecibos}
                fechaBase="2026-10-06"
                onSelectRecord={setSelectedInvoice}
              />
            )}

            {/* VISTA 3: TABLA COMPLETA DE FACTURAS */}
            {view === 'facturas' && (
              <CarteraTable
                records={filteredRecords}
                onSelectRecord={setSelectedInvoice}
                onExportExcel={handleExportExcel}
              />
            )}

            {/* VISTA 4: GRUPOS Y DIRECTORES */}
            {view === 'grupos' && (
              <GroupsView
                groups={carteraData.groupsSummary}
                executives={carteraData.executivesSummary}
                onFilterGroup={(g) => {
                  setSelectedGrupo(g);
                  setView('facturas');
                }}
                onFilterExecutive={(name) => {
                  setSelectedExecutive(name);
                  setView('facturas');
                }}
                onOpenEmailModal={handleOpenEmailModal}
              />
            )}

            {/* VISTA 5: RECIBOS DE CAJA */}
            {view === 'recibos' && (
              <RecibosCajaView recibos={filteredRecibos} />
            )}

            {/* VISTA 6: NOTAS CRÉDITO */}
            {view === 'notas' && (
              <NotasCreditoView notas={filteredNotas} />
            )}
          </>
        )}
      </main>

      {/* 5. MODALES INTERACTIVOS */}
      {selectedInvoice && (
        <InvoiceDetailModal
          record={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}

      {emailModalOpen && carteraData && (
        <EmailNotificationModal
          carteraData={carteraData}
          targetGroup={emailTargetGroup}
          targetExecutive={emailTargetExec}
          onClose={() => {
            setEmailModalOpen(false);
            setEmailTargetGroup(undefined);
            setEmailTargetExec(undefined);
          }}
        />
      )}
    </div>
  );
}

export default App;
