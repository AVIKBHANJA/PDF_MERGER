import AdmZip from "adm-zip";

interface ExtractedPdf {
  name: string;
  buffer: Buffer;
}

export function extractPdfsFromZip(zipBuffer: Buffer): ExtractedPdf[] {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  return entries
    .filter((entry) => {
      const name = entry.entryName;
      // Skip directories, macOS resource forks, and non-PDF files
      if (entry.isDirectory) return false;
      if (name.startsWith("__MACOSX")) return false;
      if (name.startsWith(".")) return false;
      if (!name.toLowerCase().endsWith(".pdf")) return false;
      return true;
    })
    .map((entry) => ({
      // Use just the filename (not the full path inside the ZIP)
      name: entry.entryName.split("/").pop() || entry.entryName,
      buffer: entry.getData(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}
