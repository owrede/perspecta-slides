declare module 'wawoff2' {
  export function decompress(buffer: Uint8Array | ArrayBuffer): Promise<Uint8Array>;
  export function compress(buffer: Uint8Array | ArrayBuffer): Promise<Uint8Array>;
}
