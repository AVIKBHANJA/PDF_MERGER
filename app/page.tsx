"use client";

import { useState, useCallback, useRef } from "react";
import FileUploadZone from "@/components/FileUploadZone";
import ProgressIndicator from "@/components/ProgressIndicator";
import DownloadButton from "@/components/DownloadButton";
import PDFFileList from "@/components/PDFFileList";

type Status = "idle" | "uploading" | "processing" | "done" | "error";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [outputName, setOutputName] = useState("merged-compressed");
  const [status, setStatus] = useState<Status>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [finalSize, setFinalSize] = useState<number>(0);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const hasFiles = files.length > 0;
  const isWorking = status === "uploading" || status === "processing";

  const handleFilesSelect = useCallback((newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleMerge = useCallback(() => {
    if (files.length === 0) return;

    // Clean up previous download URL
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl("");
    }

    setStatus("uploading");
    setUploadProgress(0);
    setErrorMessage("");

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.responseType = "blob";

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        setUploadProgress((e.loaded / e.total) * 100);
      }
    });

    xhr.upload.addEventListener("load", () => {
      setStatus("processing");
    });

    xhr.addEventListener("load", () => {
      if (xhr.status === 200) {
        const blob = xhr.response as Blob;
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);

        // Extract size information from headers
        const origSize = xhr.getResponseHeader("X-Original-Size");
        const finSize = xhr.getResponseHeader("X-Final-Size");
        if (origSize) setOriginalSize(parseInt(origSize, 10));
        if (finSize) setFinalSize(parseInt(finSize, 10));

        setStatus("done");
      } else {
        // Try to parse error from JSON response
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const json = JSON.parse(reader.result as string);
            setErrorMessage(json.error || "Server error");
          } catch {
            setErrorMessage(`Server error (${xhr.status})`);
          }
          setStatus("error");
        };
        reader.onerror = () => {
          setErrorMessage(`Server error (${xhr.status})`);
          setStatus("error");
        };
        reader.readAsText(xhr.response);
      }
    });

    xhr.addEventListener("error", () => {
      setErrorMessage("Network error. Please try again.");
      setStatus("error");
    });

    xhr.addEventListener("abort", () => {
      setStatus("idle");
    });

    xhr.open("POST", "/api/merge");
    xhr.send(formData);
  }, [files, downloadUrl]);

  const handleReset = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
    }
    setFiles([]);
    setOutputName("merged-compressed");
    setStatus("idle");
    setUploadProgress(0);
    setErrorMessage("");
    setDownloadUrl("");
    setOriginalSize(0);
    setFinalSize(0);
  }, [downloadUrl]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          PDF Merger & Compressor
        </h1>
        <p className="mt-2 text-gray-400">
          Upload any combination of PDF and ZIP files. The app merges everything
          in order and compresses the result to under 20 MB.
        </p>
      </div>

      <div className="space-y-4">
        <FileUploadZone
          label="Upload Files"
          accept=".pdf,.zip"
          description="Select PDF or ZIP files (any combination)"
          files={files}
          onFilesSelect={handleFilesSelect}
          onRemoveFile={handleRemoveFile}
        />
      </div>

      {/* PDF File List */}
      <PDFFileList files={files} />

      {/* Output filename */}
      <div className="mt-4">
        <label className="text-sm font-medium text-gray-300">
          Output filename
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="text"
            value={outputName}
            onChange={(e) => setOutputName(e.target.value)}
            placeholder="merged-compressed"
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="shrink-0 text-sm text-gray-500">.pdf</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-6 flex flex-col items-center gap-4">
        {status === "idle" || status === "error" ? (
          <button
            onClick={handleMerge}
            disabled={!hasFiles}
            className="w-full rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500"
          >
            Merge & Compress
          </button>
        ) : null}

        {/* Upload progress */}
        {status === "uploading" && (
          <div className="w-full">
            <ProgressIndicator
              progress={uploadProgress}
              label="Uploading files..."
            />
          </div>
        )}

        {/* Processing indicator */}
        {status === "processing" && (
          <div className="w-full">
            <ProgressIndicator
              progress={-1}
              label="Merging and compressing... this may take a minute"
            />
          </div>
        )}

        {/* Error message */}
        {status === "error" && errorMessage && (
          <div className="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {errorMessage}
          </div>
        )}

        {/* Download button */}
        {status === "done" && downloadUrl && (
          <div className="flex w-full flex-col items-center gap-3">
            <DownloadButton
              url={downloadUrl}
              filename={`${outputName || "merged-compressed"}.pdf`}
            />

            {/* Size information */}
            {originalSize > 0 && finalSize > 0 && (
              <div className="w-full rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm">
                <div className="flex items-center justify-between text-gray-300">
                  <span>Original size:</span>
                  <span className="font-medium">
                    {(originalSize / 1024 / 1024).toFixed(1)} MB
                  </span>
                </div>
                <div className="flex items-center justify-between text-gray-300">
                  <span>Compressed size:</span>
                  <span className="font-medium">
                    {(finalSize / 1024 / 1024).toFixed(1)} MB
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-green-500/20 pt-2 text-green-400">
                  <span className="font-medium">Space saved:</span>
                  <span className="font-bold">
                    {((1 - finalSize / originalSize) * 100).toFixed(0)}%
                    <span className="text-xs font-normal">
                      ({((originalSize - finalSize) / 1024 / 1024).toFixed(1)}{" "}
                      MB)
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reset button */}
        {(status === "done" || status === "error") && (
          <button
            onClick={handleReset}
            className="text-sm text-gray-400 underline hover:text-gray-300"
          >
            Start over
          </button>
        )}
      </div>

      {/* Merge order info */}
      <div className="mt-10 rounded-lg border border-gray-800 bg-gray-900/50 p-4 text-xs text-gray-500">
        <p className="font-medium text-gray-400">Merge order:</p>
        <ol className="mt-1 list-inside list-decimal space-y-0.5">
          <li>Files are merged in the order they are added</li>
          <li>PDFs from ZIP files are sorted alphabetically</li>
        </ol>
      </div>
    </main>
  );
}
