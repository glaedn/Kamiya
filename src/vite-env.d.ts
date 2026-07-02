/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CERBANIMO_ORIGIN?: string;
  readonly VITE_CERBANIMO_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
