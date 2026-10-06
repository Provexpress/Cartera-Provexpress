const ERP_BASE = process.env.VITE_REMISIONES_API_BASE || process.env.ERP_BASE || 'http://152.200.146.226:50010';

export default async function handler(req: any, res: any) {
  // Configuración de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Resolver el path del endpoint de destino
  let endpoint = '';
  if (req.query?.path) {
    endpoint = Array.isArray(req.query.path) ? req.query.path.join('/') : String(req.query.path);
  } else if (req.query?.match) {
    endpoint = Array.isArray(req.query.match) ? req.query.match.join('/') : String(req.query.match);
  } else if (req.url) {
    const rawPath = req.url.split('?')[0];
    endpoint = rawPath.replace(/^\/api\/erp-proxy\/?/, '').replace(/^\/erp-api\/?/, '');
  }

  // Asegurar que comience con '/'
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // Reensamblar query parameters adicionales
  const queryParams = new URLSearchParams();
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (key !== 'path' && key !== 'match') {
        if (Array.isArray(value)) {
          value.forEach((v) => queryParams.append(key, String(v)));
        } else if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      }
    }
  }

  const queryString = queryParams.toString();
  const targetUrl = `${ERP_BASE}${cleanEndpoint}${queryString ? (cleanEndpoint.includes('?') ? '&' : '?') + queryString : ''}`;

  try {
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
      },
    };

    if (req.headers.authorization) {
      (fetchOptions.headers as any)['Authorization'] = req.headers.authorization;
    }

    if (req.method === 'POST' && req.body) {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.text();

    res.status(response.status);
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    return res.send(data);
  } catch (error: any) {
    console.error('Error en erp-proxy hacia', targetUrl, error);
    return res.status(500).json({ error: error.message || 'Error proxying to ERP API' });
  }
}
