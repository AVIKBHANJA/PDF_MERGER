"use client";

import { useEffect, useState } from "react";
import JSZip from "jszip";

interface PDFFileListProps {
  files: File[];
}

interface FileInfo {
  name: string;
  source: string;
  isValid: boolean;
  validationError?: string;
}

export default function PDFFileList({ files }: PDFFileListProps) {
  const [fileInfos, setFileInfos] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const validatePDF = async (
      data: ArrayBuffer,
      filename: string,
    ): Promise<{ isValid: boolean; error?: string }> => {
      try {
        if (data.byteLength < 5) {
          return {
            isValid: false,
            error: "File too small to be a valid PDF",
          };
        }

        const header = new Uint8Array(data.slice(0, 5));
        const headerString = String.fromCharCode(...header);

        if (!headerString.startsWith("%PDF-")) {
          return {
            isValid: false,
            error: "Invalid PDF header - file may be corrupted",
          };
        }

        const lastBytes = new Uint8Array(data.slice(-1024));
        const lastString = String.fromCharCode(...lastBytes);

        if (!lastString.includes("%%EOF")) {
          return {
            isValid: false,
            error: "Missing EOF marker - file may be incomplete",
          };
        }

        return { isValid: true };
      } catch {
        return {
          isValid: false,
          error: "Failed to validate PDF",
        };
      }
    };

    const loadFiles = async () => {
      if (files.length === 0) {
        setFileInfos([]);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const fileList: FileInfo[] = [];

        for (const file of files) {
          const name = file.name.toLowerCase();

          if (name.endsWith(".pdf")) {
            const arrayBuffer = await file.arrayBuffer();
            const validation = await validatePDF(arrayBuffer, file.name);

            fileList.push({
              name: file.name,
              source: "PDF",
              isValid: validation.isValid,
              validationError: validation.error,
            });
          } else if (name.endsWith(".zip")) {
            const zip = await JSZip.loadAsync(file);
            const pdfEntries = Object.keys(zip.files)
              .filter((n) => n.toLowerCase().endsWith(".pdf"))
              .filter((n) => !zip.files[n].dir)
              .filter((n) => !n.startsWith("__MACOSX/") && !n.startsWith("."))
              .sort((a, b) => a.localeCompare(b));

            for (const entryName of pdfEntries) {
              const entry = zip.files[entryName];
              const arrayBuffer = await entry.async("arraybuffer");
              const validation = await validatePDF(arrayBuffer, entryName);

              fileList.push({
                name: entryName.split("/").pop() || entryName,
                source: file.name,
                isValid: validation.isValid,
                validationError: validation.error,
              });
            }
          }
        }

        setFileInfos(fileList);
      } catch (err) {
        setError("Failed to read files");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadFiles();
  }, [files]);

  if (files.length === 0) {
    return null;
  }

  const totalCount = fileInfos.length;
  const invalidCount = fileInfos.filter((f) => !f.isValid).length;
  const invalidFiles = fileInfos.filter((f) => !f.isValid);

  return (
    <div className="mt-6 rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-blue-300">
          PDFs to be merged
        </h3>
        <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-medium text-blue-300">
          {loading
            ? "Loading..."
            : `${totalCount} ${totalCount === 1 ? "file" : "files"}`}
        </span>
      </div>

      {error && <div className="mb-2 text-xs text-red-400">{error}</div>}

      {/* Warning for corrupted PDFs */}
      {!loading && invalidCount > 0 && (
        <div className="mb-3 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3">
          <div className="mb-2 flex items-center gap-2">
            <svg
              className="h-4 w-4 shrink-0 text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="text-xs font-semibold text-yellow-300">
              {invalidCount} corrupted or invalid{" "}
              {invalidCount === 1 ? "PDF" : "PDFs"} detected
            </span>
          </div>
          <div className="space-y-1 text-xs text-yellow-200/80">
            {invalidFiles.map((file, idx) => (
              <div key={idx} className="flex items-start gap-1">
                <span className="shrink-0">•</span>
                <span className="flex-1">
                  <span className="font-medium">{file.name}</span>
                  {file.validationError && (
                    <span className="text-yellow-300/60">
                      {" "}
                      - {file.validationError}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-yellow-300/70">
            These files will be included in the merge attempt, but may cause
            errors.
          </p>
        </div>
      )}

      {!loading && fileInfos.length > 0 && (
        <>
          {/* File list */}
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-blue-500/20 bg-gray-900/50 p-2">
            {fileInfos.map((file, index) => (
              <div
                key={`${file.source}-${index}`}
                className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${
                  file.isValid
                    ? "hover:bg-blue-500/10"
                    : "bg-yellow-500/5 hover:bg-yellow-500/10"
                }`}
                title={
                  !file.isValid && file.validationError
                    ? file.validationError
                    : undefined
                }
              >
                <span className="shrink-0 text-gray-500">{index + 1}.</span>
                {!file.isValid && (
                  <svg
                    className="h-3 w-3 shrink-0 text-yellow-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                )}
                <span
                  className={`flex-1 truncate ${
                    file.isValid ? "text-gray-300" : "text-yellow-300"
                  }`}
                >
                  {file.name}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    file.source === "PDF"
                      ? "bg-blue-500/20 text-blue-300"
                      : "bg-purple-500/20 text-purple-300"
                  }`}
                >
                  {file.source === "PDF" ? "PDF" : file.source}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
