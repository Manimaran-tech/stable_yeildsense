/// <reference types="vite/client" />

declare module 'vite-plugin-node-polyfills' {
    import { Plugin } from 'vite';
    export function nodePolyfills(options?: any): Plugin;
}
