import { jsonError } from "@/lib/api";
import heicConvert from "heic-convert";
import path from "node:path";
import sharp from "sharp";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 2560;
const MAX_PIXELS = 20_000_000;
const ALLOWED_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];

export type ProcessedUploadedImage = {
  outputBuffer: Buffer;
  outputExt: ".jpg" | ".png";
  width: number;
  height: number;
  size: number;
};

export async function processUploadedImage(file: File) {
  const nameLower = file.name.toLowerCase();
  const ext = path.extname(nameLower);
  const isHeic = file.type === "image/heic" || file.type === "image/heif";
  const isHeicExt = nameLower.endsWith(".heic") || nameLower.endsWith(".heif");
  const isImageType =
    file.type.startsWith("image/") ||
    (file.type === "" && ALLOWED_EXTS.includes(ext));

  if (!isImageType && !isHeicExt) {
    return {
      error: jsonError(
        "VALIDATION_FAILED",
        "Разрешены только изображения.",
        null,
        400
      ),
    };
  }

  if (file.size > MAX_BYTES) {
    return {
      error: jsonError(
        "VALIDATION_FAILED",
        "Файл слишком большой. Максимум 10 МБ.",
        null,
        400
      ),
    };
  }

  let inputBuffer = Buffer.from(await file.arrayBuffer());

  if (isHeic || isHeicExt) {
    try {
      const convert = heicConvert as unknown as (args: {
        buffer: Buffer;
        format: "JPEG";
        quality: number;
      }) => Promise<Buffer>;
      inputBuffer = Buffer.from(
        await convert({ buffer: inputBuffer, format: "JPEG", quality: 0.9 })
      );
    } catch {
      return {
        error: jsonError(
          "VALIDATION_FAILED",
          "HEIC не удалось конвертировать. Загрузите JPG/PNG.",
          null,
          400
        ),
      };
    }
  }

  let image = sharp(inputBuffer, { failOnError: false });
  const metadata = await image.metadata().catch(() => null);

  if (!metadata?.width || !metadata.height) {
    return {
      error: jsonError(
        "VALIDATION_FAILED",
        "Формат изображения не поддерживается.",
        null,
        400
      ),
    };
  }

  if (metadata.width * metadata.height > MAX_PIXELS) {
    return {
      error: jsonError(
        "VALIDATION_FAILED",
        "Слишком большое разрешение изображения.",
        null,
        400
      ),
    };
  }

  if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
    image = image.resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
    });
  }

  const outputIsPng = metadata.format === "png" || file.type === "image/png";
  const outputExt = outputIsPng ? ".png" : ".jpg";
  const outputBuffer = outputIsPng
    ? await image.png({ compressionLevel: 8 }).toBuffer()
    : await image.jpeg({ quality: 80, mozjpeg: true }).toBuffer();

  if (outputBuffer.byteLength > MAX_BYTES) {
    return {
      error: jsonError(
        "VALIDATION_FAILED",
        "Изображение слишком большое после сжатия.",
        null,
        400
      ),
    };
  }

  const outputMetadata = await sharp(outputBuffer, {
    failOnError: false,
  }).metadata();

  return {
    outputBuffer,
    outputExt,
    width: outputMetadata.width ?? metadata.width,
    height: outputMetadata.height ?? metadata.height,
    size: outputBuffer.byteLength,
  } satisfies ProcessedUploadedImage;
}
