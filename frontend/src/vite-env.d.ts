/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_APP_ENV?: 'development' | 'staging' | 'production';
  readonly VITE_IDLE_TIMEOUT_SECONDS?: string;
  readonly VITE_IDLE_WARNING_SECONDS?: string;
  readonly VITE_ALLOW_DESTRUCTIVE_ETL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
