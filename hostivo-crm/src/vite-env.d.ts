/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_SHEET_ID?: string;
  readonly VITE_GOOGLE_SHEET_NAME?: string;
  readonly VITE_GOOGLE_SHEET_GID?: string;
  readonly VITE_SHEET_WRITE_URL?: string;
  readonly VITE_SHEET_WRITE_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
