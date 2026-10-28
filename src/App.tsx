import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
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
  X,
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
import { AgingCards } from './components/AgingCards';
import { ActividadDelDiaWidget } from './components/ActividadDelDiaWidget';
import { WelcomeScreen } from './components/WelcomeScreen';

// Carga diferida (React.lazy) para mantener el arranque ultrarrápido (< 200 KB)
const CarteraCharts = lazy(() => import('./components/CarteraCharts').then((m) => ({ default: m.CarteraCharts })));
const CarteraTable = lazy(() => import('./components/CarteraTable').then((m) => ({ default: m.CarteraTable })));
const GroupsView = lazy(() => import('./components/GroupsView').then((m) => ({ default: m.GroupsView })));
const RecibosCajaView = lazy(() => import('./components/RecibosCajaView').then((m) => ({ default: m.RecibosCajaView })));
const NotasCreditoView = lazy(() => import('./components/NotasCreditoView').then((m) => ({ default: m.NotasCreditoView })));
const EvolucionBaseView = lazy(() => import('./components/EvolucionBaseView').then((m) => ({ default: m.EvolucionBaseView })));
const GestionDiaADiaView = lazy(() => import('./components/GestionDiaADiaView').then((m) => ({ default: m.GestionDiaADiaView })));
const InvoiceDetailModal = lazy(() => import('./components/InvoiceDetailModal').then((m) => ({ default: m.InvoiceDetailModal })));
const EmailNotificationModal = lazy(() => import('./components/EmailNotificationModal').then((m) => ({ default: m.EmailNotificationModal })));
const ClientesView = lazy(() => import('./components/ClientesView').then((m) => ({ default: m.ClientesView })));
import { DateControlBar, type DatePreset, type DateCriterion } from './components/DateControlBar';

function ViewSkeleton() {
  return (
    <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              height: 100,
              borderRadius: 14,
              backgroundColor: '#f1f5f9',
              animation: 'pulse 1.5s infinite ease-in-out',
            }}
          />
        ))}
      </div>
      <div
        style={{
          height: 380,
          borderRadius: 16,
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          color: '#64748b',
          fontSize: 14,
        }}
      >
        <Loader2 size={20} className="spinner" />
        <span>Cargando módulo de visualización…</span>
      </div>
    </div>
  );
}

type ViewMode = 'evolucion' | 'gestion' | 'dashboard' | 'facturas' | 'grupos' | 'recibos' | 'notas' | 'clientes';

const AGING_ORDER: AgeBucketKey[] = [
  'CORRIENTE',
  '1_30',
  '31_60',
  '61_90',
  '91_120',
  '121_180',
  'MAS_180',
];

interface SelectFilterOption {
  value: string;
  label: string;
}

function SelectFilter({
  label,
  value,
  options,
  onChange,
  disabled = false,
  compact = false,
  hint,
}: {
  label: string;
  value: string;
  options: SelectFilterOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
  hint?: string;
}) {
  return (
    <label className={`select-filter ${compact ? 'compact' : ''} ${disabled ? 'disabled' : ''}`} title={hint}>
      <span>{label}</span>
      <div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown size={14} />
      </div>
    </label>
  );
}

const getInitialView = (): ViewMode => {
  if (typeof window !== 'undefined') {
    const hash = window.location.hash.replace('#', '') as ViewMode;
    const validViews: ViewMode[] = ['evolucion', 'gestion', 'dashboard', 'facturas', 'grupos', 'recibos', 'notas', 'clientes'];
    if (validViews.includes(hash)) return hash;
    try {
      const saved = sessionStorage.getItem('cartera_view') as ViewMode;
      if (validViews.includes(saved)) return saved;
    } catch (_) {}
  }
  return 'dashboard';
};

export function App() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);

  // Fechas y presets
  const defaults = useMemo(() => getDefaultDateRange(), []);
  const [fechaInicial, setFechaInicial] = useState<string>(defaults.fechaInicial);
  const [fechaFinal, setFechaFinal] = useState<string>(defaults.fechaFinal);
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [dateCriterion, setDateCriterion] = useState<'vencimiento' | 'emision'>('vencimiento');

  // Datos del backend
  const [carteraData, setCarteraData] = useState<CarteraDataState | null>(null);

  // Navegación con sincronización de URL y sesión
  const [view, setViewRaw] = useState<ViewMode>(getInitialView);

  const setView = (newView: ViewMode) => {
    setViewRaw(newView);
    try {
      sessionStorage.setItem('cartera_view', newView);
      window.location.hash = newView;
    } catch (_) {}
  };

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '') as ViewMode;
      const validViews: ViewMode[] = ['evolucion', 'gestion', 'dashboard', 'facturas', 'grupos', 'recibos', 'notas', 'clientes'];
      if (validViews.includes(hash)) {
        setViewRaw(hash);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Filtros interactivos
  const [selectedAging, setSelectedAging] = useState<AgeBucketKey | 'CRITICO_30' | 'all'>('all');
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

  // Estados de autenticación y puerta de acceso (Auth Gate)
  const [authChecking, setAuthChecking] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Carga inicial de sesión M365 (silenciosa)
  useEffect(() => {
    getExistingProfile()
      .then((p) => {
        if (p) setUser(p);
      })
      .catch((err) => console.log('Sin sesión previa M365:', err))
      .finally(() => setAuthChecking(false));
  }, []);

  // Función principal de carga de datos desde ERP
  const loadData = async (isBackgroundRefresh = false, forceRefresh = false) => {
    if (!isBackgroundRefresh && !carteraData) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      // Determinamos el rango de consulta inicial para el ERP dinámicamente.
      // Consultamos desde el primer día del mes anterior hasta hoy para tener en memoria
      // tanto el mes anterior completo como el mes actual y todos los recaudos/notas en tiempo real.
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const todayStr = `${y}-${m}-${d}`;

      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevY = prevMonth.getFullYear();
      const prevM = String(prevMonth.getMonth() + 1).padStart(2, '0');
      const defaultQueryInit = `${prevY}-${prevM}-01`;

      let queryInit = defaultQueryInit;
      let queryEnd = todayStr;

      // Si el usuario especificó un rango custom específico en los inputs, lo consultamos al refrescar
      if (datePreset === 'custom' && fechaInicial && fechaFinal) {
        queryInit = fechaInicial;
        queryEnd = fechaFinal;
      }

      const data = await fetchCarteraCompleta(queryInit, queryEnd, 'D', forceRefresh);
      setCarteraData(data);
    } catch (err: any) {
      console.error('Error al cargar datos de cartera:', err);
      setError(err.message || 'Error de conexión con el backend de Cartera ERP.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Cargar datos del ERP únicamente cuando el usuario esté autenticado
  useEffect(() => {
    if (user) {
      void loadData();
    }
  }, [user]);

  // Auto-refresco en segundo plano en tiempo real cada 2 minutos (sin interrumpir la interfaz)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      void loadData(true, true);
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, datePreset, fechaInicial, fechaFinal]);

  // Manejo de cambio de Presets de Fecha
  const handleSelectPreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    if (preset === 'all') {
      setFechaInicial('2023-01-01');
      setFechaFinal(todayStr);
    } else if (preset === 'today') {
      // Corte a hoy: toda la cartera viva evaluada a la fecha de hoy
      setFechaInicial('2023-01-01');
      setFechaFinal(todayStr);
    } else if (preset === 'today_vence') {
      setFechaInicial(todayStr);
      setFechaFinal(todayStr);
      setDateCriterion('vencimiento');
    } else if (preset === 'today_emision') {
      setFechaInicial(todayStr);
      setFechaFinal(todayStr);
      setDateCriterion('emision');
    } else if (preset === 'current_month') {
      setFechaInicial(`${y}-${m}-01`);
      setFechaFinal(todayStr);
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

  // ─── CÁLCULO DINÁMICO Y REACTIVO DE MÉTRICAS FILTRADAS (EN MEMORIA 0ms) ─────
  // Se filtran los datos según Fecha (Vencimiento/Emisión), Grupo, Director, Ejecutivo, Estado, Solo Vencidas y Antigüedad
  const filteredMetrics = useMemo(() => {
    if (!carteraData) return null;

    let baseList = carteraData.records;

    // 1. Filtrado por Fecha según Preset
    if (datePreset === 'today_vence') {
      const todayStr = new Date().toISOString().split('T')[0];
      baseList = baseList.filter((r) => r.Fecha_Vencimiento && r.Fecha_Vencimiento.startsWith(todayStr));
    } else if (datePreset === 'today_emision') {
      const todayStr = new Date().toISOString().split('T')[0];
      baseList = baseList.filter((r) => r.Fecha_Emision && r.Fecha_Emision.startsWith(todayStr));
    } else if (datePreset !== 'all' && datePreset !== 'today') {
      if (fechaInicial) {
        baseList = baseList.filter((r) => {
          const dt = dateCriterion === 'vencimiento'
            ? (r.Fecha_Vencimiento ? r.Fecha_Vencimiento.split('T')[0] : '')
            : (r.Fecha_Emision ? r.Fecha_Emision.split('T')[0] : '');
          return dt >= fechaInicial;
        });
      }
      if (fechaFinal) {
        baseList = baseList.filter((r) => {
          const dt = dateCriterion === 'vencimiento'
            ? (r.Fecha_Vencimiento ? r.Fecha_Vencimiento.split('T')[0] : '')
            : (r.Fecha_Emision ? r.Fecha_Emision.split('T')[0] : '');
          return dt <= fechaFinal;
        });
      }
    }

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

    // Métricas base para la selección comercial (conserva las 7 edades en AgingCards)
    const baseMetrics = computeCarteraMetrics(baseList);

    // activeList: filtrado adicional por la edad de vencimiento seleccionada (filtrado cruzado en vivo)
    let activeList = baseList;
    if (selectedAging === 'CRITICO_30') {
      activeList = baseList.filter((r) => r.diasVencimientoCalc > 30);
    } else if (selectedAging !== 'all') {
      activeList = baseList.filter((r) => r.categoriaEdad === selectedAging);
    }

    // activeMetrics: desglose de comerciales y directores para el rango activo
    const activeMetrics = selectedAging === 'all'
      ? baseMetrics
      : computeCarteraMetrics(activeList);

    return {
      baseList,
      activeList,
      baseMetrics,
      activeMetrics,
      totalSaldo: baseMetrics.totalSaldo,
      totalCorriente: baseMetrics.totalCorriente,
      totalVencido: baseMetrics.totalVencido,
      porcentajeVencido: baseMetrics.porcentajeVencido,
      totalDocumentos: baseMetrics.totalDocumentos,
      clientesUnicos: baseMetrics.clientesUnicos,
      agingItems: baseMetrics.agingBreakdown,
      groups: activeMetrics.groupsSummary,
      executives: activeMetrics.executivesSummary,
      customers: activeMetrics.customersSummary,
    };
  }, [
    carteraData,
    selectedGrupo,
    selectedDirector,
    selectedExecutive,
    selectedEstado,
    onlyOverdue,
    selectedAging,
    datePreset,
    fechaInicial,
    fechaFinal,
    dateCriterion,
  ]);

  // Lista de facturas filtradas activas (sincronizada en tiempo real)
  const filteredRecords = useMemo(() => {
    if (!filteredMetrics) return [];
    return filteredMetrics.activeList;
  }, [filteredMetrics]);

  // Recibos de caja filtrados reactivamente según período, grupo comercial y director
  const filteredRecibos = useMemo(() => {
    if (!carteraData) return [];
    let list = carteraData.recibos;

    if (datePreset !== 'all') {
      if (fechaInicial) {
        list = list.filter((r) => {
          const rec = r.Fecha_Recaudo ? r.Fecha_Recaudo.split('T')[0] : '';
          return rec >= fechaInicial;
        });
      }
      if (fechaFinal) {
        list = list.filter((r) => {
          const rec = r.Fecha_Recaudo ? r.Fecha_Recaudo.split('T')[0] : '';
          return rec <= fechaFinal;
        });
      }
    }

    if (selectedGrupo !== 'all') {
      list = list.filter((r) => r.grupoNumero === selectedGrupo);
    }
    if (selectedDirector !== 'all') {
      list = list.filter(
        (r) => (r.directorNombre || '').toLowerCase() === selectedDirector.toLowerCase()
      );
    }
    return list;
  }, [carteraData, selectedGrupo, selectedDirector, datePreset, fechaInicial, fechaFinal]);

  // Notas crédito filtradas reactivamente según período, grupo comercial y director
  const filteredNotas = useMemo(() => {
    if (!carteraData) return [];
    let list = carteraData.notas;

    if (datePreset !== 'all') {
      if (fechaInicial) {
        list = list.filter((n) => {
          const f = n.Fecha_Emision ? n.Fecha_Emision.split('T')[0] : '';
          return f >= fechaInicial;
        });
      }
      if (fechaFinal) {
        list = list.filter((n) => {
          const f = n.Fecha_Emision ? n.Fecha_Emision.split('T')[0] : '';
          return f <= fechaFinal;
        });
      }
    }

    if (selectedGrupo !== 'all') {
      list = list.filter((n) => n.grupoNumero === selectedGrupo);
    }
    if (selectedDirector !== 'all') {
      list = list.filter(
        (n) => (n.directorNombre || '').toLowerCase() === selectedDirector.toLowerCase()
      );
    }
    return list;
  }, [carteraData, selectedGrupo, selectedDirector, datePreset, fechaInicial, fechaFinal]);

  // Registros comerciales completos para vistas de cohortes (Evolución Base 06/10 y Gestión Día a Día)
  // Conservan la base al 06/10 y las nuevas facturas, respetando los filtros comerciales
  const cohortRecords = useMemo(() => {
    if (!carteraData) return [];
    let list = carteraData.records;
    if (selectedGrupo !== 'all') {
      list = list.filter((r) => r.grupoNumero === selectedGrupo);
    }
    if (selectedDirector !== 'all') {
      list = list.filter(
        (r) => r.directorNombre.toLowerCase() === selectedDirector.toLowerCase()
      );
    }
    if (selectedExecutive !== 'all') {
      list = list.filter(
        (r) => r.Nombre_Empleado.toLowerCase() === selectedExecutive.toLowerCase()
      );
    }
    return list;
  }, [carteraData, selectedGrupo, selectedDirector, selectedExecutive]);

  const cohortRecibos = useMemo(() => {
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
    if (selectedExecutive !== 'all') {
      list = list.filter(
        (r) =>
          (r.Nombre_Empleado || '').toLowerCase() === selectedExecutive.toLowerCase() ||
          (r.asesorCanonico || '').toLowerCase() === selectedExecutive.toLowerCase()
      );
    }
    return list;
  }, [carteraData, selectedGrupo, selectedDirector, selectedExecutive]);

  const cohortNotas = useMemo(() => {
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
    if (selectedExecutive !== 'all') {
      list = list.filter(
        (n) => (n.Nombre_Empleado || '').toLowerCase() === selectedExecutive.toLowerCase()
      );
    }
    return list;
  }, [carteraData, selectedGrupo, selectedDirector, selectedExecutive]);

    // Lista de ejecutivos disponibles según el grupo seleccionado
  const availableExecutives = useMemo(() => {
    if (!carteraData) return [];
    const set = new Set<string>();
    carteraData.records.forEach((r) => {
      if (selectedGrupo !== 'all' && r.grupoNumero !== selectedGrupo) return;
      if (
        selectedDirector !== 'all' &&
        r.directorNombre.toLowerCase() !== selectedDirector.toLowerCase()
      )
        return;
      if (r.Nombre_Empleado) set.add(r.Nombre_Empleado);
    });
    return Array.from(set).sort();
  }, [carteraData, selectedGrupo, selectedDirector]);

  // Vistas auxiliares independientes que cuentan con su propio header y filtros
  const isDedicatedAuxView = view === 'recibos' || view === 'notas' || view === 'clientes';
  const isCohortView = view === 'evolucion' || view === 'gestion';
  const showHeroBanner = !isDedicatedAuxView;
  const showCarteraDateBar = view === 'dashboard' || view === 'facturas' || view === 'grupos';
  const showCarteraFilterBar = !isDedicatedAuxView;

  // Conteo de filtros activos contextuales por pestaña
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (isDedicatedAuxView) return 0;

    if (selectedGrupo !== 'all') count++;
    if (selectedDirector !== 'all') count++;

    if (view === 'dashboard' || view === 'facturas' || isCohortView) {
      if (selectedExecutive !== 'all') count++;
    }

    if (view === 'dashboard' || view === 'facturas') {
      if (selectedEstado !== 'all') count++;
      if (onlyOverdue) count++;
    }

    if (view === 'dashboard' || view === 'facturas' || view === 'grupos') {
      if (selectedAging !== 'all') count++;
      if (datePreset !== 'all') count++;
    }

    return count;
  }, [
    isDedicatedAuxView,
    view,
    isCohortView,
    selectedAging,
    selectedGrupo,
    selectedDirector,
    selectedExecutive,
    selectedEstado,
    onlyOverdue,
    datePreset,
  ]);

  const clearAllFilters = () => {
    setSelectedGrupo('all');
    setSelectedDirector('all');
    setSelectedExecutive('all');
    if (view === 'dashboard' || view === 'facturas' || view === 'grupos') {
      setSelectedAging('all');
      handleSelectPreset('all');
    }
    if (view === 'dashboard' || view === 'facturas') {
      setSelectedEstado('all');
      setOnlyOverdue(false);
    }
  };

  // Descarga rápida de Excel (carga diferida de ExcelJS)
  const handleExportExcel = async () => {
    if (!carteraData) return;
    try {
      const { generateCarteraExcel, downloadBufferAsFile } = await import('./lib/excelGenerator');
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
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const p = await signIn();
      // Validar dominio corporativo Provexpress
      const emailLower = (p.email || '').toLowerCase();
      if (!emailLower.endsWith('@provexpress.com.co') && !emailLower.includes('provexpress')) {
        throw new Error('Acceso restringido: debes iniciar sesión con una cuenta corporativa @provexpress.com.co.');
      }
      setUser(p);
    } catch (err: any) {
      console.error('Error al autenticar:', err);
      setLoginError(err.message || 'Error al autenticar con Microsoft 365.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setUser(null);
      setCarteraData(null);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleBypassLocal = () => {
    setUser({
      name: 'Desarrollador Provexpress',
      email: 'especialista.preventa@provexpress.com.co',
    });
  };

  // 1. Verificando sesión previa silenciosamente
  if (authChecking) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <img src="/logo-provexpress.png" alt="Provexpress" />
          <div className="loading-icon">
            <Loader2 size={28} />
          </div>
          <h2>Verificando credenciales</h2>
          <p>Validando sesión con Microsoft 365…</p>
          <div className="loading-track">
            <span />
          </div>
        </div>
      </div>
    );
  }

  // 2. Puerta de Acceso (Auth Gate): Si no está autenticado, mostrar pantalla oficial de bienvenida y login
  if (!user) {
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    return (
      <WelcomeScreen
        onLogin={handleLogin}
        isLoggingIn={isLoggingIn}
        error={loginError}
        onBypassLocal={isLocalhost ? handleBypassLocal : undefined}
      />
    );
  }

  // 3. Si está autenticado pero los datos del ERP están cargando
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

          {/* BARRA DE MENÚ PRINCIPAL ARRIBA (SEGMENTED NAV ESTILO REMISIONES) */}
          <nav className="segmented-nav" aria-label="Vistas del sistema" style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
            <button
              type="button"
              className={view === 'evolucion' ? 'active' : ''}
              onClick={() => setView('evolucion')}
              title="Seguimiento exclusivo a la cartera recibida al 06/10/2026 (Base fija entregada)"
            >
              <TrendingUp size={15} />
              <span>Evolución (Base 06/10)</span>
            </button>

            <button
              type="button"
              className={view === 'gestion' ? 'active' : ''}
              onClick={() => setView('gestion')}
              title="Gestión operativa día a día del proceso (Facturas recaudadas con recibo y nuevas emisiones)"
            >
              <CalendarRange size={15} />
              <span>Gestión Día a Día</span>
              <span className="nav-tab-badge green">En Vivo</span>
            </button>

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
              <span>Grupos</span>
            </button>

            <button
              type="button"
              className={view === 'clientes' ? 'active' : ''}
              onClick={() => setView('clientes')}
              title="Directorio de clientes y actualización de contactos de tesorería"
            >
              <Users size={15} />
              <span>Clientes & Tesorería</span>
              <span className="nav-tab-badge blue">
                {formatNumber(filteredMetrics ? filteredMetrics.customers.length : 0)}
              </span>
            </button>

            <button
              type="button"
              className={view === 'recibos' ? 'active' : ''}
              onClick={() => setView('recibos')}
              title="Recibos de caja y comprobantes de recaudo"
            >
              <CheckCircle2 size={15} />
              <span>Recibos</span>
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
              onClick={() => void loadData(false, true)}
              style={{ marginLeft: 'auto' }}
            >
              Reintentar
            </button>
          </div>
        )}

        {showHeroBanner && (
          <div className="hero-banner" style={{ marginBottom: 20 }}>
            <div className="hero-left">
              <div className={`eyebrow ${view === 'evolucion' ? 'purple' : view === 'gestion' ? 'green' : 'blue'}`}>
                {view === 'evolucion' ? <TrendingUp size={15} /> : view === 'gestion' ? <CalendarRange size={15} /> : <Zap size={15} />}
                <span>Provexpress Cartera · Corte al {fechaFinal}</span>
              </div>
              <h1 style={{ fontSize: 32, margin: '10px 0 6px', fontWeight: 800, letterSpacing: '-0.04em' }}>
                {view === 'evolucion'
                  ? 'Evolución de la Base Inicial (06/10)'
                  : view === 'gestion'
                  ? 'Gestión de Cartera Día a Día (Seguimiento del Proceso)'
                  : view === 'dashboard'
                  ? 'Tablero General de Edades'
                  : view === 'facturas'
                  ? 'Detalle de Facturas y Saldos'
                  : 'Grupos Comerciales y Directores'}
              </h1>
              <p style={{ margin: 0, color: '#6e6e73', fontSize: 14 }}>
                {view === 'evolucion'
                  ? 'Desmonte exclusivo de la cartera recibida al 06 de octubre de 2026. Seguimiento a la base inicial entregada al equipo comercial.'
                  : view === 'gestion'
                  ? 'Operación diaria del proceso: facturas recaudadas por Recibos de Caja, abonos y nuevas facturas emitidas.'
                  : view === 'dashboard'
                  ? 'Panorama consolidado por edades de vencimiento: Corriente, 1-30, 31-60, 61-90, 91-120, 121-180 y +180 días.'
                  : view === 'facturas'
                  ? 'Lista detallada de facturas abiertas con saldos, días de mora, estado y exportación a Excel.'
                  : 'Supervisión consolidada por grupos comerciales, directores y ejecutivos de cuenta.'}
              </p>
            </div>
          </div>
        )}

        {/* BARRA DE CONTROL DE PERÍODO Y FECHAS ESTILO MAC OS */}
        {showCarteraDateBar && (
          <DateControlBar
            datePreset={datePreset}
            dateCriterion={dateCriterion}
            fechaInicial={fechaInicial}
            fechaFinal={fechaFinal}
            totalRecordsCount={carteraData?.records.length || 0}
            filteredCount={filteredRecords.length}
            refreshing={refreshing}
            onSelectPreset={handleSelectPreset}
            onSelectCriterion={(crit) => setDateCriterion(crit)}
            onChangeFechaInicial={(d) => {
              setFechaInicial(d);
              setDatePreset('custom');
            }}
            onChangeFechaFinal={(d) => {
              setFechaFinal(d);
              setDatePreset('custom');
            }}
            onRefreshERP={() => void loadData(true, true)}
          />
        )}

        {/* NOTIFICACIÓN DE PROCESO DIARIO ESTILO REMISIONES */}
        {(view === 'evolucion' || view === 'gestion') && (
          <section className="new-cutoff-notification-banner" aria-label="Notificación de proceso diario">
            <div className="new-cutoff-banner-left" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="new-cutoff-pulse" />
              <CalendarRange size={18} />
              <div>
                <strong>
                  {view === 'evolucion'
                    ? 'Estás en la Evolución de la Base Inicial Recibida (06/10/2026)'
                    : 'Estás en la Gestión Diaria del Proceso (Día a Día)'}
                </strong>
                <span style={{ fontSize: 12.5, color: '#4b5563', display: 'block', marginTop: 1 }}>
                  {view === 'evolucion'
                    ? 'Cartera recibida de partida: 3.157 facturas · Desmonte cronológico con recibos de caja'
                    : 'Seguimiento en vivo: facturas recaudadas por Recibos de Caja y nuevas facturas emitidas'}
                </span>
              </div>
            </div>
            <div className="new-cutoff-banner-actions">
              {view === 'evolucion' ? (
                <button
                  type="button"
                  className="button button-primary cutoff-cta-btn"
                  onClick={() => setView('gestion')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                >
                  <CalendarRange size={14} /> Ver Gestión del Proceso (Día a Día) →
                </button>
              ) : (
                <button
                  type="button"
                  className="button button-outline-purple cutoff-cta-btn"
                  onClick={() => setView('evolucion')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                >
                  <TrendingUp size={14} /> Ver Desmonte en Evolución (Base 06/10) →
                </button>
              )}
            </div>
          </section>
        )}

        {/* 3. BARRA DE FILTROS SUPERIOR ESTILO REMISIONES (APPLE MAC OS) */}
        {showCarteraFilterBar && (
          <section className="filter-bar" aria-label="Filtros del tablero">
            <SelectFilter
              label="Grupo Comercial"
              value={String(selectedGrupo)}
              onChange={(val) => {
                setSelectedGrupo(val === 'all' ? 'all' : Number(val));
                setSelectedExecutive('all');
              }}
              options={[
                { value: 'all', label: 'Todos los Grupos' },
                { value: '1', label: 'Grupo 1 (Rafael Novoa)' },
                { value: '2', label: 'Grupo 2 (Angélica Caballero)' },
                { value: '3', label: 'Grupo 3 (Óscar Beltrán)' },
                { value: '4', label: 'Grupo 4 (Miller Romero)' },
                { value: '0', label: 'Gerencia / Especiales' },
              ]}
            />

            <SelectFilter
              label="Director Comercial"
              value={selectedDirector}
              onChange={(val) => setSelectedDirector(val)}
              options={[
                { value: 'all', label: 'Todos los Directores' },
                ...LISTA_DIRECTORES.map((d) => ({
                  value: d.nombre,
                  label: `${d.nombre} (Grupo ${d.grupo})`,
                })),
              ]}
            />

            {(view === 'dashboard' || view === 'facturas' || isCohortView) && (
              <SelectFilter
                label="Ejecutivo / Vendedor"
                value={selectedExecutive}
                onChange={(val) => setSelectedExecutive(val)}
                options={[
                  { value: 'all', label: 'Todos los Ejecutivos' },
                  ...availableExecutives.map((exec) => ({
                    value: exec,
                    label: exec,
                  })),
                ]}
              />
            )}

            {(view === 'dashboard' || view === 'facturas') && (
              <SelectFilter
                label="Estado Cliente"
                value={selectedEstado}
                onChange={(val) => setSelectedEstado(val)}
                options={[
                  { value: 'all', label: 'Todos los Estados' },
                  { value: 'Activo', label: 'Activo' },
                  { value: 'Inactivo', label: 'Inactivo' },
                  { value: 'Bloqueado', label: 'Bloqueado' },
                ]}
              />
            )}

            {(view === 'dashboard' || view === 'facturas' || view === 'grupos') && (
              <SelectFilter
                label="Antigüedad / Días"
                value={selectedAging}
                onChange={(val) => setSelectedAging(val as AgeBucketKey | 'all')}
                options={[
                  { value: 'all', label: 'Todas las Edades' },
                  { value: 'CORRIENTE', label: 'Corriente (Al día)' },
                  { value: '1_30', label: '1 a 30 días' },
                  { value: '31_60', label: '31 a 60 días' },
                  { value: '61_90', label: '61 a 90 días' },
                  { value: '91_120', label: '91 a 120 días' },
                  { value: '121_180', label: '121 a 180 días' },
                  { value: 'MAS_180', label: 'Más de 180 días' },
                ]}
              />
            )}

            <div className="filter-actions-group">
              {(view === 'dashboard' || view === 'facturas') && (
                <button
                  type="button"
                  className={`filter-pill-chip ${onlyOverdue ? 'active-danger' : ''}`}
                  onClick={() => setOnlyOverdue(!onlyOverdue)}
                  title={onlyOverdue ? 'Toca para ver toda la cartera' : 'Filtrar solo facturas vencidas'}
                >
                  <ShieldAlert size={14} color={onlyOverdue ? '#b91c1c' : '#6b7280'} />
                  <span>{onlyOverdue ? 'Filtrado: Solo Vencidas' : 'Solo Cartera Vencida'}</span>
                </button>
              )}

              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  className="filter-clear-btn"
                  onClick={clearAllFilters}
                  title="Quitar todos los filtros aplicados"
                >
                  <X size={13} />
                  <span>Limpiar ({activeFiltersCount})</span>
                </button>
              )}
            </div>
          </section>
        )}

        {/* 4. CONTENIDO SEGÚN LA VISTA SELECCIONADA */}
        {carteraData && filteredMetrics && (
          <Suspense fallback={<ViewSkeleton />}>
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

                <ActividadDelDiaWidget
                  records={filteredRecords}
                  recibos={cohortRecibos}
                  fechaCorte={fechaFinal}
                  fechaBase="2026-10-06"
                  onNavigateToGestion={() => setView('gestion')}
                  onNavigateToRecibos={() => setView('recibos')}
                  onSelectRecord={setSelectedInvoice}
                />

                <CarteraCharts
                  records={filteredRecords}
                  agingItems={filteredMetrics.agingItems}
                  groups={filteredMetrics.groups}
                  customers={filteredMetrics.customers}
                  executives={filteredMetrics.executives}
                  selectedAging={selectedAging}
                  onSelectAging={setSelectedAging}
                  selectedExecutive={selectedExecutive}
                  onSelectExecutive={setSelectedExecutive}
                  selectedDirector={selectedDirector}
                  onSelectDirector={setSelectedDirector}
                  onSelectRecord={setSelectedInvoice}
                  onViewFullTable={() => setView('facturas')}
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

            {/* VISTA 1: EVOLUCIÓN DE LA BASE INICIAL (CORTE 06/10) */}
            {view === 'evolucion' && (
              <EvolucionBaseView
                records={cohortRecords}
                recibos={cohortRecibos}
                fechaBase="2026-10-06"
                selectedDirectorProp={selectedDirector}
                onSelectRecord={setSelectedInvoice}
                onNavigateToGestion={() => setView('gestion')}
              />
            )}

            {/* VISTA 2: GESTIÓN OPERATIVA DÍA A DÍA (DESDE 07/10) */}
            {view === 'gestion' && (
              <GestionDiaADiaView
                records={cohortRecords}
                recibos={cohortRecibos}
                fechaBase="2026-10-06"
                selectedDirectorProp={selectedDirector}
                onSelectRecord={setSelectedInvoice}
                onSync={() => loadData(true, true)}
                isLoading={refreshing}
                onNavigateToEvolucion={() => setView('evolucion')}
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

            {/* VISTA 4: GRUPOS Y DIRECTORES (REACTIVO A FILTROS) */}
            {view === 'grupos' && (
              <GroupsView
                groups={filteredMetrics.groups}
                executives={filteredMetrics.executives}
                records={carteraData.records}
                onSelectRecord={setSelectedInvoice}
                onFilterGroup={(g) => {
                  setSelectedGrupo(g);
                  setSelectedExecutive('all');
                  setView('facturas');
                }}
                onFilterExecutive={(name, grupo, director) => {
                  if (grupo !== undefined) setSelectedGrupo(grupo);
                  if (director) setSelectedDirector(director);
                  setSelectedExecutive(name);
                  setSelectedAging('all');
                  setSelectedEstado('all');
                  setOnlyOverdue(false);
                  setView('facturas');
                }}
                onOpenEmailModal={handleOpenEmailModal}
              />
            )}

            {/* VISTA 5: RECIBOS DE CAJA */}
            {view === 'recibos' && (
              <RecibosCajaView recibos={carteraData.recibos} />
            )}

            {/* VISTA 6: NOTAS CRÉDITO */}
            {view === 'notas' && (
              <NotasCreditoView notas={carteraData.notas} />
            )}

            {/* VISTA 7: DIRECTORIO DE CLIENTES Y TESORERÍA */}
            {view === 'clientes' && (
              <ClientesView
                customers={filteredMetrics.customers}
                allRecords={carteraData.records}
                currentUser={user}
                onSelectRecord={setSelectedInvoice}
              />
            )}
          </Suspense>
        )}
      </main>

      {/* 5. MODALES INTERACTIVOS */}
      <Suspense fallback={null}>
        {selectedInvoice && (
          <InvoiceDetailModal
            record={selectedInvoice}
            currentUser={user}
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
      </Suspense>
    </div>
  );
}

export default App;
