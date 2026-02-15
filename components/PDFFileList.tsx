"use client";

import { useEffect, useState } from "react";
import JSZip from "jszip";

interface PDFFileListProps {
  pdfFile: File | null;
  zip1File: File | null;
  zip2File: File | null;
}

interface FileInfo {
  name: string;
  source: "pdf" | "zip1" | "zip2";
  isValid: boolean;
  validationError?: string;
}

export default function PDFFileList({
  pdfFile,
  zip1File,
  zip2File,
}: PDFFileListProps) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const validatePDF = async (
      data: ArrayBuffer,
      filename: string,
    ): Promise<{ isValid: boolean; error?: string }> => {
      try {
        // Check if file is too small
        if (data.byteLength < 5) {
          return {
            isValid: false,
            error: "File too small to be a valid PDF",
          };
        }

        // Check PDF header (%PDF-)
        const header = new Uint8Array(data.slice(0, 5));
        const headerString = String.fromCharCode(...header);

        if (!headerString.startsWith("%PDF-")) {
          return {
            isValid: false,
            error: "Invalid PDF header - file may be corrupted",
          };
        }

        // Check for EOF marker at the end
        const lastBytes = new Uint8Array(data.slice(-1024));
        const lastString = String.fromCharCode(...lastBytes);

        if (!lastString.includes("%%EOF")) {
          return {
            isValid: false,
            error: "Missing EOF marker - file may be incomplete",
          };
        }

        return { isValid: true };
      } catch (err) {
        return {
          isValid: false,
          error: "Failed to validate PDF",
        };
      }
    };

    const loadFiles = async () => {
      if (!pdfFile && !zip1File && !zip2File) {
        setFiles([]);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const fileList: FileInfo[] = [];

        // Add the single PDF
        if (pdfFile) {
          const arrayBuffer = await pdfFile.arrayBuffer();
          const validation = await validatePDF(arrayBuffer, pdfFile.name);

          fileList.push({
            name: pdfFile.name,
            source: "pdf",
            isValid: validation.isValid,
            validationError: validation.error,
          });
        }

        // Extract PDFs from ZIP #1
        if (zip1File) {
          const zip1 = await JSZip.loadAsync(zip1File);
          const pdfEntries = Object.keys(zip1.files)
            .filter((name) => name.toLowerCase().endsWith(".pdf"))
            .filter((name) => !zip1.files[name].dir)
            .sort((a, b) => a.localeCompare(b));

          for (const name of pdfEntries) {
            const file = zip1.files[name];
            const arrayBuffer = await file.async("arraybuffer");
            const validation = await validatePDF(arrayBuffer, name);

            fileList.push({
              name: name.split("/").pop() || name,
              source: "zip1",
              isValid: validation.isValid,
              validationError: validation.error,
            });
          }
        }

        // Extract PDFs from ZIP #2
        if (zip2File) {
          const zip2 = await JSZip.loadAsync(zip2File);
          const pdfEntries = Object.keys(zip2.files)
            .filter((name) => name.toLowerCase().endsWith(".pdf"))
            .filter((name) => !zip2.files[name].dir)
            .sort((a, b) => a.localeCompare(b));

          for (const name of pdfEntries) {
            const file = zip2.files[name];
            const arrayBuffer = await file.async("arraybuffer");
            const validation = await validatePDF(arrayBuffer, name);

            fileList.push({
              name: name.split("/").pop() || name,
              source: "zip2",
              isValid: validation.isValid,
              validationError: validation.error,
            });
          }
        }

        setFiles(fileList);
      } catch (err) {
        setError("Failed to read ZIP files");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadFiles();
  }, [pdfFile, zip1File, zip2File]);

  if (!pdfFile && !zip1File && !zip2File) {
    return null;
  }

  const pdfCount = files.filter((f) => f.source === "pdf").length;
  const zip1Count = files.filter((f) => f.source === "zip1").length;
  const zip2Count = files.filter((f) => f.source === "zip2").length;
  const totalCount = files.length;
  const invalidCount = files.filter((f) => !f.isValid).length;
  const invalidFiles = files.filter((f) => !f.isValid);

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

      {!loading && files.length > 0 && (
        <>
          {/* Summary */}
          <div className="mb-3 space-y-1 text-xs text-gray-400">
            {pdfCount > 0 && (
              <div className="flex justify-between">
                <span>Single PDF:</span>
                <span className="font-medium text-gray-300">{pdfCount}</span>
              </div>
            )}
            {zip1Count > 0 && (
              <div className="flex justify-between">
                <span>From ZIP #1:</span>
                <span className="font-medium text-gray-300">{zip1Count}</span>
              </div>
            )}
            {zip2Count > 0 && (
              <div className="flex justify-between">
                <span>From ZIP #2:</span>
                <span className="font-medium text-gray-300">{zip2Count}</span>
              </div>
            )}
          </div>

          {/* File list */}
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-blue-500/20 bg-gray-900/50 p-2">
            {files.map((file, index) => (
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
                    file.source === "pdf"
                      ? "bg-blue-500/20 text-blue-300"
                      : file.source === "zip1"
                        ? "bg-purple-500/20 text-purple-300"
                        : "bg-pink-500/20 text-pink-300"
                  }`}
                >
                  {file.source === "pdf"
                    ? "PDF"
                    : file.source === "zip1"
                      ? "ZIP1"
                      : "ZIP2"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
