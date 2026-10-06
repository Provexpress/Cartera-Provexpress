import { Component, type ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error capturado por ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#f5f5f7',
          padding: '24px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            background: '#ffffff',
            borderRadius: '20px',
            padding: '36px',
            boxShadow: '0 12px 36px rgba(0,0,0,0.06)',
            border: '1px solid #e5e5ea',
            textAlign: 'center'
          }}>
            <img src="/logo-provexpress.png" alt="Provexpress" style={{ width: '130px', marginBottom: '20px' }} />
            <h2 style={{ fontSize: '20px', color: '#111827', margin: '0 0 10px' }}>
              Se produjo un problema al cargar la aplicación
            </h2>
            <p style={{ fontSize: '13.5px', color: '#6b7280', margin: '0 0 20px', lineHeight: 1.5 }}>
              Detalle técnico: {this.state.error?.message || 'Error desconocido'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                background: '#0071e3',
                color: '#fff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
