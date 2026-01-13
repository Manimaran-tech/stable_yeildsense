// Polyfills for Node.js globals needed by Solana SDK
import { Buffer } from 'buffer'

// Make Buffer available globally
window.Buffer = Buffer
globalThis.Buffer = Buffer

// Process polyfill
if (typeof window !== 'undefined' && !window.process) {
    window.process = { env: {} } as any
}
