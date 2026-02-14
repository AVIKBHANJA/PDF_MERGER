import { PDF, PdfStream, PdfName, PdfDict } from "@libpdf/core";
import sharp from "sharp";
import { MAX_OUTPUT_SIZE } from "./constants";

const QUALITY_PASSES = [80, 60, 40, 20];

export async function compressPdf(inputBuffer: Buffer): Promise<Buffer> {
  if (inputBuffer.length <= MAX_OUTPUT_SIZE) {
    return inputBuffer;
  }

  for (const quality of QUALITY_PASSES) {
    try {
      const compressed = await reencodeImages(inputBuffer, quality);
      console.log(
        `Compression pass (quality=${quality}): ` +
          `${(inputBuffer.length / 1024 / 1024).toFixed(1)} MB -> ` +
          `${(compressed.length / 1024 / 1024).toFixed(1)} MB`,
      );
      if (compressed.length <= MAX_OUTPUT_SIZE) {
        return compressed;
      }
    } catch (err) {
      console.error(`Compression pass (quality=${quality}) failed:`, err);
    }
  }

  // Return the most aggressively compressed version even if over limit
  try {
    return await reencodeImages(inputBuffer, QUALITY_PASSES[QUALITY_PASSES.length - 1]);
  } catch {
    return inputBuffer;
  }
}

async function reencodeImages(
  pdfBuffer: Buffer,
  quality: number,
): Promise<Buffer> {
  const doc = await PDF.load(new Uint8Array(pdfBuffer));
  const registry = doc.context.registry;

  const subtypeKey = PdfName.of("Subtype");
  const widthKey = PdfName.of("Width");
  const heightKey = PdfName.of("Height");
  const filterKey = PdfName.of("Filter");
  const bpcKey = PdfName.of("BitsPerComponent");
  const csKey = PdfName.of("ColorSpace");
  const dctFilter = PdfName.of("DCTDecode");
  const dpKey = PdfName.of("DecodeParms");

  for (const [, obj] of registry.entries()) {
    if (!(obj instanceof PdfStream)) continue;

    // PdfStream extends PdfDict, so .get() works directly
    const stream = obj as PdfStream & PdfDict;

    const subtype = stream.get(subtypeKey);
    if (!subtype || (subtype as PdfName).value !== "Image") continue;

    const wObj = stream.get(widthKey);
    const hObj = stream.get(heightKey);
    if (!wObj || !hObj) continue;

    const width = getNumericValue(wObj);
    const height = getNumericValue(hObj);
    if (!width || !height || width < 2 || height < 2) continue;

    try {
      const filter = stream.get(filterKey);
      const filterName = filter ? String((filter as PdfName).value ?? filter) : "";

      if (filterName === "DCTDecode" || filterName.includes("DCTDecode")) {
        // Already JPEG — re-encode at lower quality
        const encoded = stream.getEncodedData();
        const jpegBuf = Buffer.from(encoded);

        const compressed = await sharp(jpegBuf)
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();

        if (compressed.length < jpegBuf.length) {
          stream.setData(new Uint8Array(compressed));
        }
      } else {
        // FlateDecode or other — decode raw pixels, convert to JPEG
        const decoded = stream.getDecodedData();
        if (!decoded || decoded.length === 0) continue;

        const bpcObj = stream.get(bpcKey);
        const bitsPerComponent = bpcObj ? getNumericValue(bpcObj) : 8;
        if (bitsPerComponent !== 8) continue;

        const csObj = stream.get(csKey);
        const colorSpace = csObj ? String((csObj as PdfName).value ?? csObj) : "";
        let channels: 1 | 3 | 4;
        if (colorSpace.includes("Gray")) {
          channels = 1;
        } else if (colorSpace.includes("CMYK")) {
          channels = 4;
        } else {
          channels = 3; // assume RGB
        }

        const expectedLen = width * height * channels;
        if (decoded.length < expectedLen) continue;

        const compressed = await sharp(Buffer.from(decoded), {
          raw: { width, height, channels },
        })
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();

        if (compressed.length < decoded.length) {
          stream.setData(new Uint8Array(compressed));
          stream.set(filterKey, dctFilter);
          if (stream.has(dpKey)) {
            stream.delete(dpKey);
          }
        }
      }
    } catch {
      // Skip images that can't be processed
      continue;
    }
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

function getNumericValue(obj: unknown): number {
  if (obj && typeof obj === "object" && "value" in obj) {
    const v = (obj as { value: unknown }).value;
    if (typeof v === "number") return v;
    return parseInt(String(v), 10) || 0;
  }
  return parseInt(String(obj), 10) || 0;
}
