import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { MAX_OUTPUT_SIZE } from "./constants";

const execFileAsync = promisify(execFile);

// Portable Ghostscript binary bundled with the project
const GS_BIN = path.join(
  process.cwd(),
  "bin",
  "gs-nsis",
  "bin",
  "gswin64c.exe",
);

interface GsPass {
  resolution: string;
  imageQuality: number;
}

const GS_PASSES: GsPass[] = [
  { resolution: "ebook", imageQuality: 80 }, // Start with 80% quality
  { resolution: "ebook", imageQuality: 60 },
  { resolution: "ebook", imageQuality: 40 },
  { resolution: "screen", imageQuality: 40 },
  { resolution: "screen", imageQuality: 20 },
];

export async function compressPdf(inputBuffer: Buffer): Promise<Buffer> {
  const sizeMB = (b: Buffer) => (b.length / 1024 / 1024).toFixed(1);

  // Always compress at least once to 80% quality to reduce size
  console.log(
    `Processing PDF (${sizeMB(inputBuffer)} MB), target < ${(MAX_OUTPUT_SIZE / 1024 / 1024).toFixed(0)} MB`,
  );

  for (const pass of GS_PASSES) {
    try {
      const result = await ghostscriptCompress(
        inputBuffer,
        pass.resolution,
        pass.imageQuality,
      );
      console.log(
        `  GS pass (${pass.resolution}/q${pass.imageQuality}): ${sizeMB(inputBuffer)} MB -> ${sizeMB(result)} MB`,
      );

      // If under 20MB, we're done - return this result
      if (result.length <= MAX_OUTPUT_SIZE) {
        console.log(
          `  ✓ Target size achieved with quality ${pass.imageQuality}`,
        );
        return result;
      }

      // Update input for next pass
      inputBuffer = result;
    } catch (err) {
      console.error(
        `  GS pass (${pass.resolution}/q${pass.imageQuality}) failed:`,
        err,
      );
    }
  }

  // Return the most aggressively compressed version even if over limit
  console.log(`  ⚠ Could not reach target size, returning best compression`);
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

    await execFileAsync(GS_BIN, args, { timeout: 120_000 });

    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
