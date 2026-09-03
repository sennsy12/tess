import {
  PublicClientApplication,
  type AuthenticationResult,
  type Configuration,
} from '@azure/msal-browser';

/**
 * Microsoft Entra ID sign-in (hybrid auth).
 *
 * The app keeps its local session (JWT access + refresh pair in
 * sessionStorage, see `tokenStore.ts`). Entra is only the *identity proof*:
 * MSAL (public SPA client, auth-code + PKCE) yields an ID token, which the
 * backend validates against the tenant JWKS and exchanges for the same local
 * token pair as a password login (`POST /api/auth/entra`).
 *
 * The module is inert when unconfigured: `isMicrosoftSignInAvailable()`
 * returns false unless the backend reports `enabled` (client/tenant IDs are
 * public SPA values — no secrets here). The Login page hides the Microsoft
 * button in that case, so local login always works standalone.
 *
 * @module lib/auth/msalClient
 */

export interface EntraPublicConfig {
  clientId: string;
  tenantId: string;
}

const MICROSOFT_SCOPES = ['openid', 'profile', 'email'];

let msalInstance: PublicClientApplication | null = null;
let configuredClientId: string | null = null;
let initPromise: Promise<PublicClientApplication> | null = null;

function buildConfiguration(config: EntraPublicConfig): Configuration {
  return {
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
      redirectUri: window.location.origin,
      navigateToLoginRequestUrl: false,
    },
    cache: {
      // Session-scoped like the rest of our auth state (tokenStore.ts).
      cacheLocation: 'sessionStorage',
      storeAuthStateInCookie: false,
    },
  };
}

async function getInstance(config: EntraPublicConfig): Promise<PublicClientApplication> {
  if (msalInstance && configuredClientId === config.clientId) {
    return msalInstance;
  }
  // Single-flight initialization (MSAL v3+ requires initialize() first).
  if (!initPromise || configuredClientId !== config.clientId) {
    configuredClientId = config.clientId;
    initPromise = (async () => {
      const instance = new PublicClientApplication(buildConfiguration(config));
      await instance.initialize();
      msalInstance = instance;
      return instance;
    })();
  }
  return initPromise;
}

/**
 * Interactive Microsoft sign-in. Resolves with the ID token for backend
 * exchange. Rejects with `popup_closed`/`user_cancelled` when the user
 * aborts (callers should stay silent then), or other MSAL errors.
 */
export async function loginWithMicrosoft(config: EntraPublicConfig): Promise<string> {
  const instance = await getInstance(config);
  const accounts = instance.getAllAccounts();
  try {
    // Prefer SSO when a Microsoft session already exists…
    if (accounts.length > 0) {
      const silent = await instance.acquireTokenSilent({
        scopes: MICROSOFT_SCOPES,
        account: accounts[0],
      });
      if (silent.idToken) return silent.idToken;
    }
  } catch {
    // …otherwise fall through to the interactive popup.
  }
  const result: AuthenticationResult = await instance.loginPopup({
    scopes: MICROSOFT_SCOPES,
    prompt: accounts.length > 0 ? 'select_account' : undefined,
  });
  if (!result.idToken) {
    throw new Error('no_id_token');
  }
  return result.idToken;
}

/** Best-effort Microsoft sign-out. Never throws; local logout always wins. */
export async function logoutMicrosoft(): Promise<void> {
  try {
    if (!msalInstance) return;
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) return;
    await msalInstance.logoutPopup({ account: accounts[0] });
  } catch {
    // Popup blocked/closed or already signed out — local session is already
    // cleared by the caller, so there is nothing left to do.
  }
}

/** True when the user aborted the popup (silent handling, not an error). */
export function isPopupCancelled(err: unknown): boolean {
  const code =
    typeof err === 'object' && err !== null
      ? String((err as { errorCode?: unknown }).errorCode ?? '')
      : '';
  return code === 'user_cancelled' || code === 'popup_window_error';
}
