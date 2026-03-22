import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { MAX_OUTPUT_SIZE } from "./constants";
import { GS_BIN } from "./gs";

const execFileAsync = promisify(execFile);

// 10 minute timeout — Render free tier has 0.1 CPU so compression is very slow
const GS_TIMEOUT = 10 * 60 * 1000;

export async function compressPdf(inputBuffer: Buffer): Promise<Buffer> {
  const sizeMB = (b: Buffer) => (b.length / 1024 / 1024).toFixed(1);

  // If already under limit, skip compression entirely
  if (inputBuffer.length <= MAX_OUTPUT_SIZE) {
    console.log(
      `PDF is ${sizeMB(inputBuffer)} MB, already under ${(MAX_OUTPUT_SIZE / 1024 / 1024).toFixed(0)} MB — skipping compression`,
    );
    return inputBuffer;
  }

  console.log(
    `Compressing PDF (${sizeMB(inputBuffer)} MB), target < ${(MAX_OUTPUT_SIZE / 1024 / 1024).toFixed(0)} MB`,
  );

  // Single aggressive pass — fastest route to <20MB on slow hardware
  try {
    console.log(`  Starting GS compression (screen/q40)...`);
    const result = await ghostscriptCompress(inputBuffer, "screen", 40);
    console.log(
      `  Compressed: ${sizeMB(inputBuffer)} MB -> ${sizeMB(result)} MB`,
    );
    return result;
  } catch (err) {
    console.error(
      `  GS compression failed:`,
      err instanceof Error ? err.message : err,
    );
  }

  // Return uncompressed if GS fails
  console.log(`  Returning uncompressed: ${sizeMB(inputBuffer)} MB`);
  return inputBuffer;
}

async function ghostscriptCompress(
  pdfBuffer: Buffer,
  resolution: string,
  imageQuality: number,
): Promise<Buffer> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdfcompress-"));
  const inputPath = path.join(tmpDir, "input.pdf");
  const outputPath = path.join(tmpDir, "output.pdf");

  try {
    await fs.writeFile(inputPath, pdfBuffer);

    const args = [
      "-q",
      "-dNOPAUSE",
      "-dBATCH",
      "-dSAFER",
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      `-dPDFSETTINGS=/${resolution}`,
      "-dSubsetFonts=true",
      "-dAutoRotatePages=/None",
      `-dColorImageResolution=${imageQuality}`,
      `-dGrayImageResolution=${imageQuality}`,
      `-dMonoImageResolution=${imageQuality}`,
      `-sOutputFile=${outputPath}`,
      inputPath,
    ];

    await execFileAsync(GS_BIN, args, { timeout: GS_TIMEOUT });

    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
