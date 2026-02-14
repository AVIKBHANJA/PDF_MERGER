import { PDFDocument } from "pdf-lib";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

const GS_BIN = path.join(
  process.cwd(),
  "bin",
  "gs-nsis",
  "bin",
  "gswin64c.exe",
);

/** Run a malformed PDF through Ghostscript to repair it */
async function repairPdf(pdfBuffer: Buffer): Promise<Buffer> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdfrepair-"));
  const inputPath = path.join(tmpDir, "input.pdf");
  const outputPath = path.join(tmpDir, "output.pdf");

  try {
    await fs.writeFile(inputPath, pdfBuffer);
    await execFileAsync(
      GS_BIN,
      [
        "-q",
        "-dNOPAUSE",
        "-dBATCH",
        "-dSAFER",
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        `-sOutputFile=${outputPath}`,
        inputPath,
      ],
      { timeout: 60_000 },
    );
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function mergePdfs(buffers: Buffer[]): Promise<Buffer> {
  const merged = await PDFDocument.create();

  for (let i = 0; i < buffers.length; i++) {
    if (buffers[i].length === 0) continue;

    let buf = buffers[i];
    try {
      const donor = await PDFDocument.load(buf, { ignoreEncryption: true });
      const pages = await merged.copyPages(donor, donor.getPageIndices());
      for (const page of pages) {
        merged.addPage(page);
      }
    } catch {
      // PDF failed to parse — repair it with Ghostscript and retry
      console.warn(`PDF at index ${i} is malformed, repairing with Ghostscript...`);
      buf = await repairPdf(buf);
      const donor = await PDFDocument.load(buf, { ignoreEncryption: true });
      const pages = await merged.copyPages(donor, donor.getPageIndices());
      for (const page of pages) {
        merged.addPage(page);
      }
      console.log(`PDF at index ${i} repaired and merged successfully`);
    }
  }

  if (merged.getPageCount() === 0) {
    throw new Error("No valid PDF pages could be merged");
  }

  const bytes = await merged.save();
  return Buffer.from(bytes);
}
