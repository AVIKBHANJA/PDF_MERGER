"use client";

import { useCallback, useRef, useState } from "react";

interface FileUploadZoneProps {
  label: string;
  accept: string;
  description: string;
  files: File[];
  onFilesSelect: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
}

export default function FileUploadZone({
  label,
  accept,
  description,
  files,
  onFilesSelect,
  onRemoveFile,
}: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
        onFilesSelect(droppedFiles);
      }
    },
    [onFilesSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files;
      if (selected && selected.length > 0) {
        onFilesSelect(Array.from(selected));
      }
      // Reset so the same files can be re-selected
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [onFilesSelect],
  );

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-300">{label}</label>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed
          p-8 transition-colors cursor-pointer
          ${
            isDragOver
              ? "border-blue-400 bg-blue-400/10"
              : files.length > 0
                ? "border-green-500/50 bg-green-500/5"
                : "border-gray-700 bg-gray-900 hover:border-gray-500 hover:bg-gray-800/50"
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          onChange={handleChange}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-2 text-center">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${files.length > 0 ? "bg-green-500/20" : "bg-gray-800"}`}
          >
            {files.length > 0 ? (
              <svg
                className="h-5 w-5 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            )}
          </div>
          <p className="text-sm text-gray-400">
            {files.length > 0 ? (
              "Drop more files or click to add"
            ) : (
              <>
                Drop files here or <span className="text-blue-400">browse</span>
              </>
            )}
          </p>
          <p className="text-xs text-gray-600">{description}</p>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-1 space-y-1">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center justify-between rounded-lg border border-gray-700/50 bg-gray-900/50 px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    file.name.toLowerCase().endsWith(".zip")
                      ? "bg-purple-500/20 text-purple-300"
                      : "bg-blue-500/20 text-blue-300"
                  }`}
                >
                  {file.name.toLowerCase().endsWith(".zip") ? "ZIP" : "PDF"}
                </span>
                <span className="truncate text-sm text-gray-300">
                  {file.name}
                </span>
                <span className="shrink-0 text-xs text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFile(index);
                }}
                className="ml-2 shrink-0 text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
