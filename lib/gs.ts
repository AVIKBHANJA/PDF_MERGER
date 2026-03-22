import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

/** Resolve the Ghostscript binary path for the current platform */
function findGsBinary(): string {
  if (process.platform !== "win32") {
    return "gs"; // Linux/macOS — installed via package manager
  }

  // Windows: try bundled binary first
  const bundled = path.join(
    process.cwd(),
    "bin",
    "gs-nsis",
    "bin",
    "gswin64c.exe",
  );
  if (fs.existsSync(bundled)) {
    return bundled;
  }

  // Windows: try system-installed Ghostscript via PATH
  try {
    const result = execFileSync("where", ["gswin64c"], {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    if (result) return result.split("\n")[0].trim();
  } catch {
    // not in PATH
  }

  // Windows: check common install locations
  const programDirs = [
    process.env["ProgramFiles"] || "C:\\Program Files",
    process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)",
  ];
  for (const dir of programDirs) {
    const gsDir = path.join(dir, "gs");
    if (fs.existsSync(gsDir)) {
      try {
        const versions = fs.readdirSync(gsDir).sort().reverse();
        for (const ver of versions) {
          const bin = path.join(gsDir, ver, "bin", "gswin64c.exe");
          if (fs.existsSync(bin)) return bin;
        }
      } catch {
        // skip
      }
    }
  }

  // Fallback — will fail at runtime with a clear error
  return "gswin64c";
}

export const GS_BIN = findGsBinary();
