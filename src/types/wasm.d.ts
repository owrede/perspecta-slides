declare module '*.wasm' {
  /** esbuild's "base64" loader emits the file contents as a base64 string. */
  const content: string;
  export default content;
}
