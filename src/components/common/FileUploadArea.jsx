import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Upload,
  X,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
  Loader2,
  AlertCircle,
} from 'lucide-react';

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed file types
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/gif',
];

/**
 * Get appropriate icon for a file based on MIME type
 */
function getFileIcon(mimeType) {
  if (mimeType === 'application/pdf') {
    return <FileText className="w-4 h-4 text-red-400" />;
  }
  if (mimeType?.includes('word') || mimeType?.includes('document')) {
    return <FileText className="w-4 h-4 text-blue-400" />;
  }
  if (mimeType?.includes('sheet') || mimeType?.includes('excel') || mimeType?.includes('csv')) {
    return <FileSpreadsheet className="w-4 h-4 text-green-400" />;
  }
  if (mimeType?.startsWith('image/')) {
    return <ImageIcon className="w-4 h-4 text-purple-400" />;
  }
  return <File className="w-4 h-4 text-gray-400" />;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Reusable drag-and-drop file upload area component
 */
export default function FileUploadArea({
  files = [],
  onFilesSelected,
  onRemoveFile,
  maxFiles = 5,
  isUploading = false,
  disabled = false,
  className = '',
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const validateFiles = (fileList) => {
    const validFiles = [];
    const errors = [];

    for (const file of fileList) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: File type not allowed`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large (max 10MB)`);
        continue;
      }
      if (files.length + validFiles.length >= maxFiles) {
        errors.push(`Maximum ${maxFiles} files allowed`);
        break;
      }
      validFiles.push(file);
    }

    if (errors.length > 0) {
      setError(errors.join('. '));
      setTimeout(() => setError(null), 5000);
    }

    return validFiles;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled || isUploading) return;

    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = validateFiles(droppedFiles);
    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const validFiles = validateFiles(selectedFiles);
    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className={className}>
      {/* Drag and drop zone */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
          ${isDragging
            ? 'border-blue-400 bg-blue-500/10'
            : 'border-white/20 hover:border-white/40 bg-white/5'
          }
          ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isUploading}
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-blue-200 text-sm">Uploading files...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-blue-400" />
            <p className="text-white text-sm">
              Drag & drop files here, or <span className="text-blue-400">browse</span>
            </p>
            <p className="text-blue-300/70 text-xs">
              PDF, DOC, DOCX, TXT, CSV, XLS, XLSX, PNG, JPG, GIF (max 10MB each)
            </p>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-2 p-2 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Uploaded files list */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-blue-200 text-sm font-medium">{files.length} file{files.length !== 1 ? 's' : ''} uploaded</p>
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-2 bg-white/5 rounded-lg border border-white/10"
            >
              {getFileIcon(file.mimeType)}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm truncate">{file.originalName}</p>
                <p className="text-blue-300/70 text-xs">{formatFileSize(file.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFile(file.id);
                }}
                disabled={disabled || isUploading}
                className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
