'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, Loader2, X } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isUploading?: boolean;
  /** Accepted MIME types e.g. "application/pdf,image/*" */
  accept?: string;
  /** Max file size in bytes (default 25MB) */
  maxSizeBytes?: number;
}

export function FileUpload({
  onFileSelect,
  isUploading = false,
  accept,
  maxSizeBytes = 25 * 1024 * 1024,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null);
      if (file.size > maxSizeBytes) {
        const maxMB = (maxSizeBytes / (1024 * 1024)).toFixed(0);
        setError(`File size exceeds ${maxMB}MB limit.`);
        return;
      }
      onFileSelect(file);
    },
    [onFileSelect, maxSizeBytes],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        validateAndSelect(file);
      }
    },
    [validateAndSelect],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        validateAndSelect(file);
      }
      // Reset the input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [validateAndSelect],
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8
          transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-500
          ${
            isDragOver
              ? 'border-portal-400 bg-portal-50'
              : 'border-gray-200 bg-gray-50 hover:border-portal-300 hover:bg-portal-50/50'
          }
          ${isUploading ? 'pointer-events-none opacity-60' : ''}
        `}
        aria-label="Upload file by clicking or dragging and dropping"
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={accept}
          onChange={handleFileChange}
          aria-hidden="true"
          tabIndex={-1}
        />
        {isUploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-portal-500" aria-hidden="true" />
        ) : (
          <Upload className="h-8 w-8 text-gray-400" aria-hidden="true" />
        )}
        <p className="mt-3 text-sm font-medium text-gray-700">
          {isUploading ? 'Uploading...' : 'Drag and drop a file, or click to browse'}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Max file size: {(maxSizeBytes / (1024 * 1024)).toFixed(0)}MB
        </p>
      </div>

      {error && (
        <div
          className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          <X className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}
    </div>
  );
}
