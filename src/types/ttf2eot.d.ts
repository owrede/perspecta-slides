declare module 'ttf2eot' {
  /**
   * Converts a TTF font (sfnt-flavored) to the EOT format Microsoft Office
   * uses for PPTX embedded fonts.
   */
  function ttf2eot(ttf: Uint8Array): Uint8Array;
  export = ttf2eot;
}
