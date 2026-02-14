declare module "heic-convert" {
  type HeicConvertInput =
    | Buffer
    | ArrayBuffer
    | Uint8Array;

  type HeicConvertOptions = {
    buffer: HeicConvertInput;
    format: "JPEG" | "PNG";
    quality?: number;
  };

  function heicConvert(options: HeicConvertOptions): Promise<Buffer>;

  export default heicConvert;
}
