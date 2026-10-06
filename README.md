# Cartera y Edades · Provexpress S.A.S.

Sistema de gestión, análisis y seguimiento en tiempo real de la cartera comercial y edades de vencimiento de Provexpress SAS. Desarrollado con la estética corporativa y experiencia de usuario (Apple HIG) del proyecto de Remisiones, preparado para despliegue ágil en **Vercel** e integrado con el backend ERP institucional y **Microsoft 365**.

---

## 🚀 Características Principales

1. **Tablero de Control en Tiempo Real (Primera Vista)**:
   - **Total de Cartera Hoy**: Saldo total consolidado en cuentas por cobrar.
   - **Cartera Corriente (No Vencida / 0 días)**: Saldo al día de clientes.
   - **Cartera Vencida**: Monto global e índice de morosidad porcentual.
   - **Desglose por Edades de Vencimiento (Aging Buckets)**:
     - `Corriente / 0 días`: Al día
     - `1 a 30 días (30)`
     - `31 a 60 días (60)`
     - `61 a 90 días (90)`
     - `91 a 120 días (120)`
     - `121 a 180 días (180)`
     - `Más de 180 días (> 180)`: Cartera crítica
   - Filtro interactivo al hacer clic en cualquier tarjeta de edad.

2. **Estructura Comercial y Grupos**:
   - Visualización y supervisión por Grupos Comerciales oficiales:
     - **Grupo 1**: Rafael Novoa
     - **Grupo 2**: Angélica Caballero
     - **Grupo 3**: Óscar Beltrán
     - **Grupo 4**: Miller Romero
     - **Gerencia General / Cuentas Especiales**
   - Resumen de saldo corriente vs. vencido por grupo.
   - Acordeón interactivo con cada uno de los ejecutivos de cuenta, sus facturas asociadas y cartera vencida.

3. **Detalle de Facturas y Líneas de Producto**:
   - Tabla de facturas con ordenamiento multicriterio (saldo, vencimiento, cliente, vendedor).
   - Buscador universal por razón social, NIT, número de factura o comercial.
   - Modal de detalle de factura que muestra las líneas de producto con código, descripción, cantidades y precios unitarios.

4. **Recaudos y Notas Crédito**:
   - Pestaña de **Recibos de Caja**: consulta de pagos ingresados, días de recaudo y facturas canceladas.
   - Pestaña de **Notas Crédito**: seguimiento de notas crédito del período y su impacto en la cartera.

5. **Integración con Microsoft 365**:
   - Autenticación corporativa mediante Microsoft Entra ID (Azure AD) con MSAL Browser.
   - Envío de notificaciones y estados de cuenta a Directores y Comerciales a través de Microsoft Graph API (`/me/sendMail`).
   - Generación en vivo de libros **Excel (.xlsx)** estilizados con la identidad visual corporativa de Provexpress mediante `exceljs`.

6. **Despliegue en Vercel (Sin problemas de Mixed Content o CORS)**:
   - La API del ERP funciona sobre HTTP (`http://152.200.146.226:50010`).
   - El proyecto incluye una Serverless Function en `api/erp-proxy.ts` configurada en `vercel.json` para enrutar todas las consultas `/erp-api/...` en producción de forma segura mediante HTTPS.

---

## 🛠️ APIs ERP Integradas

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/getKey` | `POST` | Autenticación y obtención de token Bearer |
| `/consultas/api/consultaCarteraEdadesDashboardPBI` | `GET` | Saldos de cartera, fechas, clientes, productos y edades |
| `/consultas/api/consultaDocumentosRecibosCajaPBI` | `GET` | Recibos de caja y recaudos de dinero |
| `/consultas/api/consultaNotasCreditoPBI` | `GET` | Notas crédito emitidas |

---

## ⚙️ Variables de Entorno

Crear un archivo `.env.local` (o configurar en las variables de entorno de Vercel):

```env
# Microsoft 365 / Azure AD
VITE_AZURE_CLIENT_ID=4a2b9726-2736-4f72-9e7e-c64cfdc80253
VITE_AZURE_TENANT_ID=e6805558-f5bb-444c-8af2-5f3a4d6dd3fc

# Backend ERP Provexpress
VITE_REMISIONES_API_BASE=http://152.200.146.226:50010
VITE_REMISIONES_API_USER="powerbi"
VITE_REMISIONES_API_PASS="3xpress#2025"
```

---

## 💻 Desarrollo Local

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo en http://localhost:5173
npm run dev

# Compilar para producción
npm run build

# Previsualizar compilación
npm run preview
```

---

## ☁️ Despliegue en Vercel

1. Subir el repositorio a GitHub o conectar la carpeta mediante el Vercel CLI:
   ```bash
   vercel
   ```
2. Configurar las variables de entorno en el panel de **Vercel Project Settings -> Environment Variables**:
   - `VITE_AZURE_CLIENT_ID`
   - `VITE_AZURE_TENANT_ID`
   - `VITE_REMISIONES_API_BASE`
   - `VITE_REMISIONES_API_USER`
   - `VITE_REMISIONES_API_PASS`
3. El archivo `vercel.json` ya incluye los rewrites y el proxy de `api/erp-proxy.ts` para que todas las llamadas al ERP funcionen transparentemente en HTTPS.
