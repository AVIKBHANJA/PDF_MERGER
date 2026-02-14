"use client";

import { useCallback, useRef, useState } from "react";

interface FileUploadZoneProps {
  label: string;
  accept: string;
  description: string;
  file: File | null;
  onFileSelect: (file: File | null) => void;
}

export default function FileUploadZone({
  label,
  accept,
  description,
  file,
  onFileSelect,
}: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        onFileSelect(droppedFile);
      }
    },
    [onFileSelect]
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
      const selected = e.target.files?.[0];
      onFileSelect(selected || null);
    },
    [onFileSelect]
  );

  const handleRemove = useCallback(() => {
    onFileSelect(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [onFileSelect]);

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
              : file
                ? "border-green-500/50 bg-green-500/5"
                : "border-gray-700 bg-gray-900 hover:border-gray-500 hover:bg-gray-800/50"
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />

        {file ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20">
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
            </div>
            <p className="text-sm font-medium text-green-400 truncate max-w-full">
              {file.name}
            </p>
            <p className="text-xs text-gray-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              className="mt-1 text-xs text-red-400 hover:text-red-300 underline"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800">
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
            </div>
            <p className="text-sm text-gray-400">
              Drop file here or <span className="text-blue-400">browse</span>
            </p>
            <p className="text-xs text-gray-600">{description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
