import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Mail,
  MailCheck,
  MailWarning,
  Phone,
  Search,
  ShieldAlert,
  User,
  Users,
  X,
} from 'lucide-react';
import type { CarteraRecord, CustomerSummary, UserProfile } from '../types';
import { formatCurrency, formatNumber, formatPercent } from '../lib/carteraApi';
import {
  getAllClientContacts,
  syncClientContactsFromSupabase,
  type ClientContact,
} from '../lib/clientContactsStorage';
import { ClientContactModal } from './ClientContactModal';
import { CustomerInvoicesModal } from './CustomerInvoicesModal';

interface Props {
  customers: CustomerSummary[];
  allRecords: CarteraRecord[];
  currentUser?: UserProfile | null;
  onSelectRecord?: (record: CarteraRecord) => void;
}

type ContactFilter = 'all' | 'with_email' | 'without_email' | 'overdue';
type SortOrder = 'saldo_desc' | 'vencido_desc' | 'nombre_asc' | 'docs_desc';

export function ClientesView({
  customers,
  allRecords,
  currentUser,
  onSelectRecord,
}: Props) {
  const [contacts, setContacts] = useState<Record<string, ClientContact>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [contactFilter, setContactFilter] = useState<ContactFilter>('all');
  const [selectedGrupo, setSelectedGrupo] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOrder>('saldo_desc');
  const [isExporting, setIsExporting] = useState(false);

  // Modales
  const [editingCustomer, setEditingCustomer] = useState<CustomerSummary | null>(null);
  const [inspectingCustomer, setInspectingCustomer] = useState<CustomerSummary | null>(null);

  // Cargar contactos iniciales y sincronizar
  useEffect(() => {
    setContacts(getAllClientContacts());
    void syncClientContactsFromSupabase().then((loaded) => {
      setContacts({ ...loaded });
    });

    const handleContactUpdate = (e: any) => {
      if (e.detail && e.detail.nit) {
        setContacts((prev) => ({
          ...prev,
          [e.detail.nit]: e.detail,
        }));
      }
    };

    window.addEventListener('client-contact-updated', handleContactUpdate);
    return () => window.removeEventListener('client-contact-updated', handleContactUpdate);
  }, []);

  // Métricas generales del directorio
  const stats = useMemo(() => {
    const total = customers.length;
    let conCorreo = 0;
    let conVencido = 0;
    let totalSaldo = 0;
    let totalVencido = 0;

    customers.forEach((c) => {
      totalSaldo += c.totalSaldo;
      totalVencido += c.totalVencido;
      if (c.totalVencido > 0) conVencido += 1;
      const ct = contacts[c.nit];
      if (ct && ct.correoTesoreria && ct.correoTesoreria.trim().length > 0) {
        conCorreo += 1;
      }
    });

    const sinCorreo = total - conCorreo;
    const pctCobertura = total > 0 ? (conCorreo / total) * 100 : 0;

    return {
      total,
      conCorreo,
      sinCorreo,
      conVencido,
      totalSaldo,
      totalVencido,
      pctCobertura,
    };
  }, [customers, contacts]);

  // Lista filtrada de clientes
  const filteredCustomers = useMemo(() => {
    let list = customers;

    // Filtro por término de búsqueda
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter((c) => {
        const ct = contacts[c.nit];
        return (
          c.nit.toLowerCase().includes(q) ||
          c.empresa.toLowerCase().includes(q) ||
          c.comercial.toLowerCase().includes(q) ||
          c.directorNombre.toLowerCase().includes(q) ||
          (ct?.correoTesoreria && ct.correoTesoreria.toLowerCase().includes(q)) ||
          (ct?.contactoTesoreria && ct.contactoTesoreria.toLowerCase().includes(q))
        );
      });
    }

    // Filtro por grupo
    if (selectedGrupo !== 'all') {
      list = list.filter((c) => c.grupo === selectedGrupo);
    }

    // Filtro por estado de contacto
    if (contactFilter === 'with_email') {
      list = list.filter((c) => {
        const ct = contacts[c.nit];
        return Boolean(ct && ct.correoTesoreria && ct.correoTesoreria.trim().length > 0);
      });
    } else if (contactFilter === 'without_email') {
      list = list.filter((c) => {
        const ct = contacts[c.nit];
        return !ct || !ct.correoTesoreria || ct.correoTesoreria.trim().length === 0;
      });
    } else if (contactFilter === 'overdue') {
      list = list.filter((c) => c.totalVencido > 0);
    }

    // Ordenamiento
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'saldo_desc':
          return b.totalSaldo - a.totalSaldo;
        case 'vencido_desc':
          return b.totalVencido - a.totalVencido;
        case 'nombre_asc':
          return a.empresa.localeCompare(b.empresa);
        case 'docs_desc':
          return b.docCount - a.docCount;
        default:
          return b.totalSaldo - a.totalSaldo;
      }
    });
  }, [customers, contacts, searchTerm, selectedGrupo, contactFilter, sortBy]);

  // Descarga de Excel profesional
  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const { generateCustomerDirectoryExcel, downloadBufferAsFile } = await import('../lib/excelGenerator');
      const { buffer, filename } = await generateCustomerDirectoryExcel(
        filteredCustomers,
        contacts,
        contactFilter === 'all' ? 'Completo' : contactFilter
      );
      downloadBufferAsFile(buffer, filename);
    } catch (err: any) {
      console.error('Error al exportar directorio a Excel:', err);
      alert('Error al generar Excel del directorio.');
    } finally {
      setIsExporting(false);
    }
  };

  // Facturas del cliente inspeccionado
  const inspectingRecords = useMemo(() => {
    if (!inspectingCustomer) return [];
    return allRecords.filter((r) => r.Identificacion === inspectingCustomer.nit);
  }, [inspectingCustomer, allRecords]);

  return (
    <div className="clientes-view-container" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. HERO BANNER DE DIRECTORIO */}
      <div
        className="hero-banner"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(240, 249, 255, 0.9))',
          borderColor: '#bae6fd',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div className="eyebrow blue" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Users size={14} />
            <span>Directorio de Clientes & Contactos de Tesorería Provexpress</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '8px 0 4px', color: '#0f172a' }}>
            Base Maestra de Clientes y Tesorería
          </h1>
          <p style={{ margin: 0, color: '#475569', fontSize: 13.5 }}>
            Consolide los correos de facturación y tesorería de cada cliente para agilizar la gestión de cobro, conciliación y envío de estados de cuenta.
          </p>
        </div>

        <button
          type="button"
          className="button button-primary"
          onClick={handleExportExcel}
          disabled={isExporting}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', fontWeight: 700 }}
        >
          <Download size={15} />
          <span>{isExporting ? 'Generando Excel...' : 'Descargar Directorio Excel'}</span>
        </button>
      </div>

      {/* 2. TARJETAS KPI DE COBERTURA */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        {/* Total Clientes */}
        <div className="aging-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Total Clientes Activos
            </span>
            <Users size={18} color="#2563eb" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a' }}>
            {formatNumber(stats.total)}
          </div>
          <span style={{ fontSize: 12, color: '#64748b', marginTop: 4, display: 'block' }}>
            Con saldo vigente en cartera
          </span>
        </div>

        {/* Cobertura de Correo Registrado */}
        <div
          className="aging-card"
          style={{
            padding: '16px 20px',
            backgroundColor: stats.pctCobertura >= 50 ? '#f0fdf4' : '#fffbeb',
            borderColor: stats.pctCobertura >= 50 ? '#bbf7d0' : '#fde68a',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
              Con Correo Tesorería
            </span>
            <MailCheck size={18} color="#16a34a" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: '#166534' }}>
              {formatNumber(stats.conCorreo)}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#15803d' }}>
              ({stats.pctCobertura.toFixed(1)}%)
            </span>
          </div>
          <div style={{ width: '100%', height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, stats.pctCobertura)}%`,
                height: '100%',
                backgroundColor: '#16a34a',
                borderRadius: 3,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>

        {/* Clientes Pendientes por Contacto */}
        <div
          className="aging-card"
          style={{
            padding: '16px 20px',
            backgroundColor: stats.sinCorreo > 0 ? '#fff1f2' : '#f8fafc',
            borderColor: stats.sinCorreo > 0 ? '#fecdd3' : '#e2e8f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#9f1239', textTransform: 'uppercase' }}>
              Pendientes de Correo
            </span>
            <MailWarning size={18} color="#e11d48" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#9f1239' }}>
            {formatNumber(stats.sinCorreo)}
          </div>
          <span style={{ fontSize: 12, color: '#9f1239', marginTop: 4, display: 'block' }}>
            Requieren registrar contacto
          </span>
        </div>

        {/* Saldo Total de Cartera */}
        <div className="aging-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Saldo Total Cartera
            </span>
            <FileSpreadsheet size={18} color="#475569" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>
            {formatCurrency(stats.totalSaldo)}
          </div>
          <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, marginTop: 4, display: 'block' }}>
            {formatCurrency(stats.totalVencido)} en mora ({stats.totalSaldo > 0 ? ((stats.totalVencido / stats.totalSaldo) * 100).toFixed(1) : 0}%)
          </span>
        </div>
      </div>

      {/* 3. BARRA DE HERRAMIENTAS: BÚSQUEDA, FILTROS Y ORDENAMIENTO */}
      <div
        className="filter-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '14px 18px',
        }}
      >
        {/* Barra de búsqueda */}
        <div style={{ position: 'relative', minWidth: 260, flex: '1 1 280px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
            }}
          />
          <input
            type="text"
            placeholder="Buscar por Empresa, NIT, Comercial, Correo o Contacto…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              fontSize: 13.5,
              backgroundColor: '#ffffff',
              outline: 'none',
            }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Chips de filtro por correo */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`preset-chip ${contactFilter === 'all' ? 'active' : ''}`}
            onClick={() => setContactFilter('all')}
          >
            Todos ({stats.total})
          </button>
          <button
            type="button"
            className={`preset-chip ${contactFilter === 'with_email' ? 'active' : ''}`}
            onClick={() => setContactFilter('with_email')}
            style={contactFilter === 'with_email' ? { backgroundColor: '#16a34a', color: '#fff' } : {}}
          >
            Con Correo ({stats.conCorreo})
          </button>
          <button
            type="button"
            className={`preset-chip ${contactFilter === 'without_email' ? 'active' : ''}`}
            onClick={() => setContactFilter('without_email')}
            style={contactFilter === 'without_email' ? { backgroundColor: '#e11d48', color: '#fff' } : {}}
          >
            Sin Correo ({stats.sinCorreo})
          </button>
          <button
            type="button"
            className={`preset-chip ${contactFilter === 'overdue' ? 'active' : ''}`}
            onClick={() => setContactFilter('overdue')}
          >
            Con Mora ({stats.conVencido})
          </button>
        </div>

        {/* Selector de Grupo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={String(selectedGrupo)}
            onChange={(e) => setSelectedGrupo(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            style={{
              padding: '7px 10px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              fontSize: 12.5,
              backgroundColor: '#ffffff',
              fontWeight: 600,
              color: '#334155',
            }}
          >
            <option value="all">Todos los Grupos</option>
            <option value="1">Grupo 1 (Novoa)</option>
            <option value="2">Grupo 2 (Caballero)</option>
            <option value="3">Grupo 3 (Beltrán)</option>
            <option value="4">Grupo 4 (Romero)</option>
            <option value="0">Gerencia / Especiales</option>
          </select>

          {/* Selector de Orden */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOrder)}
            style={{
              padding: '7px 10px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              fontSize: 12.5,
              backgroundColor: '#ffffff',
              fontWeight: 600,
              color: '#334155',
            }}
          >
            <option value="saldo_desc">Mayor Saldo</option>
            <option value="vencido_desc">Mayor Saldo Vencido</option>
            <option value="nombre_asc">Nombre Empresa (A-Z)</option>
            <option value="docs_desc">Más Facturas</option>
          </select>
        </div>
      </div>

      {/* 4. TABLA DE CLIENTES Y CONTACTOS */}
      <div
        className="table-card"
        style={{
          borderRadius: 14,
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#fafbfc',
          }}
        >
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#334155' }}>
            Mostrando {formatNumber(filteredCustomers.length)} clientes
            {searchTerm ? ` filtrados por "${searchTerm}"` : ''}
          </span>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            Haga clic en <strong>"Editar Contacto"</strong> para registrar o actualizar el correo de tesorería.
          </span>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: '72vh' }}>
          <table className="cartera-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '12px 14px', textAlign: 'left', minWidth: 260 }}>Cliente / Razón Social</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', minWidth: 200 }}>Comercial & Grupo</th>
                <th style={{ padding: '12px 14px', textAlign: 'right', minWidth: 150 }}>Saldo Total</th>
                <th style={{ padding: '12px 14px', textAlign: 'right', minWidth: 140 }}>Estado Mora</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', minWidth: 280 }}>Contacto Tesorería / Correo</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', minWidth: 150 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                    <Users size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>No se encontraron clientes con los filtros seleccionados.</p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  const contact = contacts[cust.nit];
                  const hasEmail = Boolean(contact && contact.correoTesoreria && contact.correoTesoreria.trim().length > 0);
                  const pctVencido = cust.totalSaldo > 0 ? (cust.totalVencido / cust.totalSaldo) * 100 : 0;

                  return (
                    <tr
                      key={cust.nit}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.15s ease',
                      }}
                      className="client-row-hover"
                    >
                      {/* 1. Cliente / NIT */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 13.5 }}>
                          {cust.empresa}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                          <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600, fontFamily: 'monospace' }}>
                            NIT: {cust.nit}{cust.dv ? `-${cust.dv}` : ''}
                          </span>
                          <span
                            className="badge"
                            style={{
                              fontSize: 10,
                              padding: '1px 6px',
                              backgroundColor: cust.estadoCliente === 'Activo' ? '#dcfce7' : '#fee2e2',
                              color: cust.estadoCliente === 'Activo' ? '#15803d' : '#b91c1c',
                            }}
                          >
                            {cust.estadoCliente || 'Activo'}
                          </span>
                        </div>
                      </td>

                      {/* 2. Comercial & Grupo */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 600, color: '#334155' }}>
                          {cust.comercial}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                          <span
                            className="badge"
                            style={{
                              fontSize: 10.5,
                              padding: '2px 6px',
                              backgroundColor: '#f1f5f9',
                              color: '#475569',
                              fontWeight: 700,
                            }}
                          >
                            G{cust.grupo}: {cust.directorNombre}
                          </span>
                        </div>
                      </td>

                      {/* 3. Saldo Total */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 14 }}>
                          {formatCurrency(cust.totalSaldo)}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                          {cust.docCount} facturas
                        </div>
                      </td>

                      {/* 4. Estado de Mora */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', verticalAlign: 'top' }}>
                        {cust.totalVencido > 0 ? (
                          <>
                            <div style={{ fontWeight: 800, color: '#dc2626', fontSize: 13.5 }}>
                              {formatCurrency(cust.totalVencido)}
                            </div>
                            <div style={{ fontSize: 11, color: '#b91c1c', fontWeight: 700, marginTop: 2 }}>
                              {pctVencido.toFixed(0)}% en mora
                            </div>
                          </>
                        ) : (
                          <span
                            className="badge"
                            style={{
                              backgroundColor: '#dcfce7',
                              color: '#15803d',
                              fontWeight: 700,
                              fontSize: 11,
                              padding: '3px 8px',
                            }}
                          >
                            Al Día (100% Corriente)
                          </span>
                        )}
                      </td>

                      {/* 5. Contacto Tesorería */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                        {hasEmail ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <a
                              href={`mailto:${contact!.correoTesoreria}`}
                              style={{
                                color: '#2563eb',
                                fontWeight: 700,
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: 12.5,
                              }}
                              title={`Enviar correo a ${contact!.correoTesoreria}`}
                            >
                              <Mail size={13} />
                              <span style={{ wordBreak: 'break-all' }}>{contact!.correoTesoreria}</span>
                            </a>
                            {contact!.contactoTesoreria && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#475569', fontSize: 12 }}>
                                <User size={12} color="#64748b" />
                                <span>{contact!.contactoTesoreria}</span>
                              </div>
                            )}
                            {contact!.telefonoTesoreria && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#16a34a', fontSize: 11.5, fontWeight: 600 }}>
                                <Phone size={11} />
                                <span>{contact!.telefonoTesoreria}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '3px 8px',
                                borderRadius: 6,
                                backgroundColor: '#fff1f2',
                                color: '#be123c',
                                fontSize: 11.5,
                                fontWeight: 600,
                                border: '1px solid #fecdd3',
                              }}
                            >
                              <AlertCircle size={12} />
                              <span>Sin correo registrado</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingCustomer(cust)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#2563eb',
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                padding: 0,
                              }}
                            >
                              + Registrar
                            </button>
                          </div>
                        )}
                      </td>

                      {/* 6. Acciones */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            className="button button-xs button-secondary"
                            onClick={() => setEditingCustomer(cust)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, padding: '4px 8px' }}
                            title="Actualizar datos de tesorería"
                          >
                            <Edit3 size={12} />
                            <span>{hasEmail ? 'Editar' : 'Registrar'}</span>
                          </button>

                          <button
                            type="button"
                            className="button button-xs button-secondary"
                            onClick={() => setInspectingCustomer(cust)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, padding: '4px 8px' }}
                            title="Ver facturas abiertas del cliente"
                          >
                            <Eye size={12} />
                            <span>Facturas</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: EDITAR / REGISTRAR CONTACTO */}
      {editingCustomer && (
        <ClientContactModal
          customer={editingCustomer}
          existingContact={contacts[editingCustomer.nit] || null}
          currentUser={currentUser}
          onClose={() => setEditingCustomer(null)}
          onSaved={(updated) => {
            setContacts((prev) => ({
              ...prev,
              [updated.nit]: updated,
            }));
          }}
        />
      )}

      {/* MODAL 2: VER FACTURAS DEL CLIENTE */}
      {inspectingCustomer && (
        <CustomerInvoicesModal
          customer={inspectingCustomer}
          invoices={inspectingRecords}
          onClose={() => setInspectingCustomer(null)}
          onSelectInvoice={(rec) => {
            if (onSelectRecord) onSelectRecord(rec);
            setInspectingCustomer(null);
          }}
          onEditContact={() => {
            setEditingCustomer(inspectingCustomer);
            setInspectingCustomer(null);
          }}
        />
      )}
    </div>
  );
}
