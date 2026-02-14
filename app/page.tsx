"use client";

import { useState, useCallback, useRef } from "react";
import FileUploadZone from "@/components/FileUploadZone";
import ProgressIndicator from "@/components/ProgressIndicator";
import DownloadButton from "@/components/DownloadButton";

type Status = "idle" | "uploading" | "processing" | "done" | "error";

export default function Home() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [zip1File, setZip1File] = useState<File | null>(null);
  const [zip2File, setZip2File] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const allFilesSelected = pdfFile && zip1File && zip2File;
  const isWorking = status === "uploading" || status === "processing";

  const handleMerge = useCallback(() => {
    if (!pdfFile || !zip1File || !zip2File) return;

    // Clean up previous download URL
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl("");
    }

    setStatus("uploading");
    setUploadProgress(0);
    setErrorMessage("");

    const formData = new FormData();
    formData.append("pdf", pdfFile);
    formData.append("zip1", zip1File);
    formData.append("zip2", zip2File);

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
  }, [pdfFile, zip1File, zip2File, downloadUrl]);

  const handleReset = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
    }
    setPdfFile(null);
    setZip1File(null);
    setZip2File(null);
    setStatus("idle");
    setUploadProgress(0);
    setErrorMessage("");
    setDownloadUrl("");
  }, [downloadUrl]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          PDF Merger & Compressor
        </h1>
        <p className="mt-2 text-gray-400">
          Upload 1 PDF and 2 ZIP files. The app merges everything in order and
          compresses the result to under 20 MB.
        </p>
      </div>

      <div className="space-y-4">
        <FileUploadZone
          label="1. Single PDF"
          accept=".pdf"
          description="Select a .pdf file"
          file={pdfFile}
          onFileSelect={setPdfFile}
        />
        <FileUploadZone
          label="2. ZIP File #1"
          accept=".zip"
          description="Select a .zip containing PDFs"
          file={zip1File}
          onFileSelect={setZip1File}
        />
        <FileUploadZone
          label="3. ZIP File #2"
          accept=".zip"
          description="Select a .zip containing PDFs"
          file={zip2File}
          onFileSelect={setZip2File}
        />
      </div>

      {/* Action buttons */}
      <div className="mt-6 flex flex-col items-center gap-4">
        {status === "idle" || status === "error" ? (
          <button
            onClick={handleMerge}
            disabled={!allFilesSelected}
            className="w-full rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500"
          >
            Merge & Compress
          </button>
        ) : null}

        {/* Upload progress */}
        {status === "uploading" && (
          <div className="w-full">
            <ProgressIndicator progress={uploadProgress} label="Uploading files..." />
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
          <DownloadButton url={downloadUrl} filename="merged-compressed.pdf" />
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
          <li>The single PDF file</li>
          <li>PDFs from ZIP #1 (sorted alphabetically)</li>
          <li>PDFs from ZIP #2 (sorted alphabetically)</li>
        </ol>
      </div>
    </main>
  );
}
