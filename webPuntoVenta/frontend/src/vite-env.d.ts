/// <reference types="vite/client" />

/**
 * Describe las variables de entorno que vite permite utilizar
 * dentro del codigo del fronted.
 */
interface ImportMetaEnv {
    readonly VITE_API_URL: string;
}

/**
 * Extiende el objeto import.meta para que TypeScript conozca
 * las variables declaradas arriba.
 */
interface ImportMeta {
    readonly env: ImportMetaEnv;
}
