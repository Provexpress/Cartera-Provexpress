import { CheckCircle2, Cloud, Loader2, LogIn, ShieldAlert, ShieldCheck, Terminal } from 'lucide-react';

interface Props {
  onLogin: () => void;
  isLoggingIn: boolean;
  error?: string | null;
  onBypassLocal?: () => void;
}

export function WelcomeScreen({ onLogin, isLoggingIn, error, onBypassLocal }: Props) {
  return (
    <main className="welcome-shell">
      <section className="welcome-copy">
        <div className="brand-lockup">
          <img src="/logo-provexpress.png" alt="Provexpress" />
          <span>Gestión Financiera</span>
        </div>

        <div className="eyebrow blue">
          <ShieldCheck size={16} /> Portal Corporativo de Cartera
        </div>

        <h1>
          Cartera & Cobranzas,<br />
          <span>bajo control.</span>
        </h1>

        <p>
          Supervisa saldos por edades, gestión diaria de cobranza, efectividad de recaudo y notas crédito de Provexpress S.A.S. en tiempo real.
        </p>

        {error && (
          <div className="welcome-error" role="alert">
            <ShieldAlert size={19} />
            <div>
              <strong>Error de autenticación</strong>
              <span>{error}</span>
            </div>
          </div>
        )}

        <div className="welcome-actions">
          <button
            type="button"
            className="button button-primary button-large"
            onClick={onLogin}
            disabled={isLoggingIn}
            title="Iniciar sesión con tu cuenta corporativa de Microsoft 365"
          >
            {isLoggingIn ? (
              <>
                <Loader2 size={19} className="spin" />
                <span>Conectando con Microsoft 365...</span>
              </>
            ) : (
              <>
                <LogIn size={19} />
                <span>Iniciar con Microsoft 365</span>
              </>
            )}
          </button>

          {onBypassLocal && (
            <button
              type="button"
              className="button button-secondary button-large"
              onClick={onBypassLocal}
              title="Acceso directo de desarrollo (Solo visible en localhost)"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <Terminal size={17} />
              <span>Modo Prueba Local (Dev)</span>
            </button>
          )}
        </div>

        <div className="trust-row">
          <span>
            <CheckCircle2 size={16} /> Acceso exclusivo @provexpress.com.co
          </span>
          <span>
            <Cloud size={16} /> Sincronización en vivo con ERP Siesa
          </span>
        </div>
      </section>

      <aside className="welcome-visual" aria-label="Resumen del portal financiero">
        <div className="visual-orb visual-orb-one" />
        <div className="visual-orb visual-orb-two" />
        <div className="preview-window">
          <div className="preview-toolbar">
            <i /><i /><i />
            <span>Cartera · Provexpress ERP</span>
          </div>
          <div className="preview-content">
            <div className="preview-label">SALDO TOTAL DE CARTERA</div>
            <div className="preview-amount">$ 10.439 MM</div>
            <div className="preview-change">Monitoreo y recuperación activa</div>

            <div className="preview-chart">
              {[42, 58, 48, 72, 65, 84, 76, 92, 88, 98, 91, 100].map((height, index) => (
                <span key={index} style={{ height: `${height}%` }} />
              ))}
            </div>

            <div className="preview-cards">
              <div>
                <span>Facturas</span>
                <strong>1.280</strong>
              </div>
              <div>
                <span>% Vencido</span>
                <strong>42.8%</strong>
              </div>
              <div>
                <span>Equipos</span>
                <strong>4</strong>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </main>
  );
}
