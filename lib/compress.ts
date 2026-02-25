import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { MAX_OUTPUT_SIZE } from "./constants";

const execFileAsync = promisify(execFile);

// Use system Ghostscript on Linux, bundled binary on Windows
const GS_BIN =
  process.platform === "win32"
    ? path.join(process.cwd(), "bin", "gs-nsis", "bin", "gswin64c.exe")
    : "gs";

// Per-pass timeout: 5 minutes (Render free tier has 0.1 CPU)
const GS_TIMEOUT = 5 * 60 * 1000;

interface GsPass {
  resolution: string;
  imageQuality: number;
}

// Ordered from aggressive to most aggressive — skip gentle passes to save time
const GS_PASSES: GsPass[] = [
  { resolution: "ebook", imageQuality: 60 },
  { resolution: "screen", imageQuality: 40 },
  { resolution: "screen", imageQuality: 20 },
];

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
    `Processing PDF (${sizeMB(inputBuffer)} MB), target < ${(MAX_OUTPUT_SIZE / 1024 / 1024).toFixed(0)} MB`,
  );

  for (const pass of GS_PASSES) {
    try {
      console.log(
        `  Starting GS pass (${pass.resolution}/q${pass.imageQuality})...`,
      );
      const result = await ghostscriptCompress(
        inputBuffer,
        pass.resolution,
        pass.imageQuality,
      );
      console.log(
        `  GS pass (${pass.resolution}/q${pass.imageQuality}): ${sizeMB(inputBuffer)} MB -> ${sizeMB(result)} MB`,
      );

      if (result.length <= MAX_OUTPUT_SIZE) {
        console.log(
          `  Target size achieved with quality ${pass.imageQuality}`,
        );
        return result;
      }

      // Use compressed output as input for next pass
      inputBuffer = result;
    } catch (err) {
      console.error(
        `  GS pass (${pass.resolution}/q${pass.imageQuality}) failed:`,
        err instanceof Error ? err.message : err,
      );
      // Continue to next pass instead of getting stuck
    }
  }

  // Return whatever we have — even uncompressed is better than hanging
  console.log(`  Returning best result: ${sizeMB(inputBuffer)} MB`);
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
      `-dCompatibilityLevel=1.4`,
      `-dPDFSETTINGS=/${resolution}`,
      "-dEmbedAllFonts=true",
      "-dSubsetFonts=true",
      "-dAutoRotatePages=/None",
      "-dColorImageDownsampleType=/Bicubic",
      `-dColorImageResolution=${imageQuality}`,
      "-dGrayImageDownsampleType=/Bicubic",
      `-dGrayImageResolution=${imageQuality}`,
      "-dMonoImageDownsampleType=/Bicubic",
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
