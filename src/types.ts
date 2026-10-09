export type AgeBucketKey =
  | 'CORRIENTE'
  | '1_30'
  | '31_60'
  | '61_90'
  | '91_120'
  | '121_180'
  | 'MAS_180';

export interface CarteraProducto {
  Codigo: string;
  Descripcion: string;
  Cantidad: number;
  Valor_Producto: number;
  Valor_Total: number;
}

export interface CarteraRecord {
  Grupo_Comercial: string | null;
  Nombre_Empleado: string;
  Identificacion: string;
  Dv: string;
  Empresa: string;
  Cupo_Credito: number;
  Estado_Cliente: string;
  Plazo_PagoCliente: number;
  Prefijo: string;
  Numero: number;
  Tipo_Documento: string;
  Fecha_Emision: string;
  Fecha_Vencimiento: string;
  Plazo_Pago: number;
  Dias_Emision: number;
  Dias_Vencimiento: number;
  Rango_Cartera: string;
  Valor_Saldo: number;
  Productos: CarteraProducto[];
  // Campos calculados y enriquecidos
  id: string;
  grupoNumero: number;
  grupoNombre: string;
  directorNombre: string;
  directorEmail: string;
  ejecutivoEmail?: string;
  categoriaEdad: AgeBucketKey;
  diasVencimientoCalc: number;
  estaVencida: boolean;
}

export interface ReciboCajaRecord {
  Grupo_Personal: string;
  Nombre_Empleado: string;
  Identificacion: string;
  Empresa: string;
  Prefijo_ReciboCaja: string;
  Numero_ReciboCaja: number;
  Fecha_Recaudo: string;
  Prefijo_FacturaVenta: string;
  Numero_FacturaVenta: number;
  Fecha_Emision: string;
  Fecha_Vencimiento: string;
  Dias_PlazoPago: number;
  Dias_Pago: number;
  Valor_Factura: number;
  Valor_Pagado: number;
  // Enriquecidos
  id: string;
  grupoNumero: number;
  directorNombre: string;
  gestorCartera?: string;
  asesorCanonico?: string;
}

export interface NotaCreditoRecord {
  Grupo_Personal: string;
  Nombre_Empleado: string;
  Identificacion: string;
  Empresa: string;
  Prefijo: string;
  Numero: number;
  Fecha_Emision: string;
  Valor_NotaCredito: number;
  Prefijo_Factura: string;
  Numero_Factura: number;
  // Enriquecidos
  id: string;
  grupoNumero: number;
  directorNombre: string;
}

export interface AgeBucketConfig {
  key: AgeBucketKey;
  label: string;
  shortLabel: string;
  minDays: number;
  maxDays: number;
  color: string;
  badgeClass: string;
}

export interface AgingSummaryItem {
  key: AgeBucketKey;
  label: string;
  shortLabel: string;
  totalValor: number;
  count: number;
  percentage: number;
  color: string;
  badgeClass: string;
}

export interface GroupSummary {
  grupo: number;
  grupoNombre: string;
  directorNombre: string;
  directorEmail: string;
  totalSaldo: number;
  totalCorriente: number;
  totalVencido: number;
  porcentajeVencido: number;
  docCount: number;
  clientesCount: number;
  ejecutivosCount: number;
  aging: Record<AgeBucketKey, number>;
}

export interface ExecutiveSummary {
  nombre: string;
  email: string;
  grupo: number;
  grupoNombre: string;
  directorNombre: string;
  totalSaldo: number;
  totalCorriente: number;
  totalVencido: number;
  porcentajeVencido: number;
  docCount: number;
  clientesCount: number;
  aging: Record<AgeBucketKey, number>;
}

export interface CustomerSummary {
  nit: string;
  dv: string;
  empresa: string;
  cupoCredito: number;
  estadoCliente: string;
  plazoPago: number;
  totalSaldo: number;
  totalCorriente: number;
  totalVencido: number;
  docCount: number;
  comercial: string;
  grupo: number;
  directorNombre: string;
  aging: Record<AgeBucketKey, number>;
}

export interface CarteraDataState {
  records: CarteraRecord[];
  recibos: ReciboCajaRecord[];
  notas: NotaCreditoRecord[];
  totalSaldo: number;
  totalCorriente: number;
  totalVencido: number;
  porcentajeVencido: number;
  totalRecaudosPeriodo: number;
  totalNotasPeriodo: number;
  clientesUnicos: number;
  totalDocumentos: number;
  cupoTotalComprometido: number;
  agingBreakdown: AgingSummaryItem[];
  groupsSummary: GroupSummary[];
  executivesSummary: ExecutiveSummary[];
  customersSummary: CustomerSummary[];
  fechaCorte: string;
  fechaConsulta: string;
}

export interface UserProfile {
  name: string;
  email: string;
  role?: 'admin' | 'director' | 'executive';
  group?: number;
}

export interface DateFilterPreset {
  id: 'today' | 'current_month' | 'last_month' | 'custom';
  label: string;
  fechaInicial: string;
  fechaFinal: string;
}
