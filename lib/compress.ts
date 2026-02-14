import { MAX_OUTPUT_SIZE } from "./constants";

export async function compressPdf(inputBuffer: Buffer): Promise<Buffer> {
  if (inputBuffer.length <= MAX_OUTPUT_SIZE) {
    return inputBuffer;
  }

  // LibPDF's merge already re-serialises and strips dead objects.
  // Without Ghostscript, further compression of embedded images isn't
  // possible in pure JS.  Return the buffer as-is and log the size.
  console.warn(
    `Merged PDF is ${(inputBuffer.length / 1024 / 1024).toFixed(1)} MB ` +
      `(limit: ${(MAX_OUTPUT_SIZE / 1024 / 1024).toFixed(0)} MB). ` +
      `Install Ghostscript for deeper compression.`,
  );

  return inputBuffer;
}
