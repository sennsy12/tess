/** Application environment and session configuration (Vite env). */

export type AppEnvironment = 'development' | 'staging' | 'production';

function parseEnv(): AppEnvironment {
  const raw = import.meta.env.VITE_APP_ENV?.toLowerCase();
  if (raw === 'production' || raw === 'staging' || raw === 'development') {
    return raw;
  }
  return import.meta.env.PROD ? 'production' : 'development';
}

export const appEnvironment: AppEnvironment = parseEnv();

export const isProduction = appEnvironment === 'production';

/** Show destructive ETL / dev-only tools when not production. */
export const allowDestructiveEtl = !isProduction || import.meta.env.VITE_ALLOW_DESTRUCTIVE_ETL === 'true';

function parseSeconds(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Total idle seconds before auto-logout. */
export const idleTimeoutSeconds = parseSeconds(
  import.meta.env.VITE_IDLE_TIMEOUT_SECONDS,
  isProduction ? 1800 : 900,
);

/** Seconds of inactivity before showing the warning modal. */
export const idleWarningSeconds = parseSeconds(
  import.meta.env.VITE_IDLE_WARNING_SECONDS,
  Math.max(60, idleTimeoutSeconds - 120),
);

export const environmentLabel: Record<AppEnvironment, string> = {
  development: 'Utvikling',
  staging: 'Staging',
  production: 'Produksjon',
};

export const supportEmail =
  import.meta.env.VITE_SUPPORT_EMAIL?.trim() || 'support@tess.no';

export const supportMailto = `mailto:${supportEmail}?subject=TESS%20-%20Hjelp`;
