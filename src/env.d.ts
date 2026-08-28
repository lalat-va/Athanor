/// <reference types="vite/client" />

declare module '*.css' {
  const content: any;
  export default content;
}

interface ImportMetaEnv {
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
