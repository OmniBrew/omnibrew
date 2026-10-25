declare module 'jsonpack/main' {
  const jsonpack: {
    pack: (json: unknown) => string
    unpack: (packed: string) => unknown
  }
  export default jsonpack
}
