import { PDF } from "@libpdf/core";

export async function mergePdfs(buffers: Buffer[]): Promise<Buffer> {
  const uint8Arrays = buffers.map((b) => new Uint8Array(b));
  const merged = await PDF.merge(uint8Arrays);
  const bytes = await merged.save();
  return Buffer.from(bytes);
}
