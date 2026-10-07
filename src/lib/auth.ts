import {
  PublicClientApplication,
  type AccountInfo,
  type AuthenticationResult,
  type Configuration,
} from '@azure/msal-browser';
import type { UserProfile } from '../types';

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID || '4a2b9726-2736-4f72-9e7e-c64cfdc80253';
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID || 'e6805558-f5bb-444c-8af2-5f3a4d6dd3fc';

const scopes = ['User.Read'];
const mailScopes = ['User.Read', 'Mail.Send'];

const config: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: typeof window !== 'undefined' ? `${window.location.origin}/redirect.html` : '',
    postLogoutRedirectUri: typeof window !== 'undefined' ? window.location.origin : '',
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
};

let msalApp: PublicClientApplication | null = null;
let initialization: Promise<void> | null = null;

export function isCryptoSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.crypto !== 'undefined' && !!window.crypto.subtle;
}

function getMsalInstance(): PublicClientApplication {
  if (!msalApp) {
    if (!isCryptoSupported()) {
      throw new Error('Web Cryptography no disponible en conexiones HTTP de red local. En Vercel (HTTPS) o localhost funciona con normalidad.');
    }
    msalApp = new PublicClientApplication(config);
  }
  return msalApp;
}

function initialize(): Promise<void> {
  if (!clientId || !tenantId) {
    return Promise.reject(new Error('Falta configurar VITE_AZURE_CLIENT_ID o VITE_AZURE_TENANT_ID.'));
  }

  if (!isCryptoSupported()) {
    return Promise.reject(new Error('MSAL requiere HTTPS o localhost.'));
  }

  let app: PublicClientApplication;
  try {
    app = getMsalInstance();
  } catch (err: any) {
    return Promise.reject(err);
  }

  if (!initialization) {
    initialization = app
      .initialize()
      .then(async () => {
        const result = await app.handleRedirectPromise();
        if (result?.account) app.setActiveAccount(result.account);
        const account = app.getActiveAccount() || app.getAllAccounts()[0];
        if (account) app.setActiveAccount(account);
      })
      .catch((err) => {
        console.warn('Fallo al inicializar MSAL:', err);
      });
  }
  return initialization;
}

async function accountFromLogin(): Promise<AccountInfo> {
  await initialize();
  const app = getMsalInstance();
  const existing = app.getActiveAccount() || app.getAllAccounts()[0];
  if (existing) {
    app.setActiveAccount(existing);
    return existing;
  }
  const result = await app.loginPopup({ scopes, prompt: 'select_account' });
  if (!result.account) throw new Error('Microsoft 365 no devolvió una cuenta válida.');
  app.setActiveAccount(result.account);
  return result.account;
}

async function acquireToken(account: AccountInfo): Promise<AuthenticationResult> {
  const app = getMsalInstance();
  try {
    return await app.acquireTokenSilent({ scopes, account });
  } catch {
    return app.acquireTokenPopup({ scopes, account });
  }
}

async function graphFetch(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body?.error?.message || `Microsoft Graph respondió ${response.status}.`;
    throw new Error(message);
  }
  return response;
}

export async function getExistingProfile(): Promise<UserProfile | null> {
  if (!isCryptoSupported()) return null;
  try {
    await initialize();
    const app = getMsalInstance();
    const account = app.getActiveAccount() || app.getAllAccounts()[0];
    if (!account) return null;
    app.setActiveAccount(account);
    return {
      name: account.name || account.username.split('@')[0],
      email: account.username.toLowerCase(),
    };
  } catch (err) {
    console.warn('Sin sesión previa o MSAL no soportado en este contexto HTTP:', err);
    return null;
  }
}

export async function signIn(): Promise<UserProfile> {
  const account = await accountFromLogin();
  const token = await acquireToken(account);
  const response = await graphFetch('/me?$select=displayName,mail,userPrincipalName', token.accessToken);
  const profile = await response.json();
  return {
    name: profile.displayName || account.name || 'Usuario',
    email: (profile.mail || profile.userPrincipalName || account.username).toLowerCase(),
  };
}

export async function signOut(): Promise<void> {
  try {
    await initialize();
    const app = getMsalInstance();
    const account = app.getActiveAccount() || app.getAllAccounts()[0];
    if (account) {
      await app.logoutPopup({ account, postLogoutRedirectUri: window.location.origin });
    }
  } catch (err) {
    console.error('Error al cerrar sesión:', err);
  }
}

export async function acquireMailToken(): Promise<string> {
  const account = await accountFromLogin();
  const app = getMsalInstance();
  try {
    const res = await app.acquireTokenSilent({ scopes: mailScopes, account });
    return res.accessToken;
  } catch {
    const res = await app.acquireTokenPopup({ scopes: mailScopes, account });
    return res.accessToken;
  }
}

export const microsoftConfig = { clientId, tenantId, scopes, mailScopes };
