// Type declarations for raw file imports (used by esbuild)

declare module '*.css?raw' {
  const content: string;
  export default content;
}

declare module '*.css' {
  const content: string;
  export default content;
}

declare module '*.frag' {
  const content: string;
  export default content;
}

declare module '*.woff2' {
  // Inlined as a base64 string by esbuild's "base64" loader.
  const base64: string;
  export default base64;
}
