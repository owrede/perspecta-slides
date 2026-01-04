// Type declarations for raw file imports (used by esbuild)

declare module '*.css?raw' {
    const content: string;
    export default content;
}

declare module '*.css' {
    const content: string;
    export default content;
}
