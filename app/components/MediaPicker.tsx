'use client';

import { useState, useRef } from 'react';
import { ImagePlus, X, Loader2 } from 'lucide-react';

interface MediaPickerProps {
  onMediaSelect: (mediaUrl: string, type: string) => void;
  onRemove?: () => void;
  selectedMedia?: string | null;
  maxFileSize?: number; // in bytes, default 10MB
  accept?: string; // MIME types to accept
}

export function MediaPicker({
  onMediaSelect,
  onRemove,
  selectedMedia,
  maxFileSize = 10 * 1024 * 1024,
  accept = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm',
}: MediaPickerProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input
    event.target.value = '';

    // Validate file size
    if (file.size > maxFileSize) {
      setError(`File too large. Maximum size is ${maxFileSize / 1024 / 1024}MB.`);
      return;
    }

    // Validate file type
    const allowedTypes = accept.split(',');
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type.');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();
      onMediaSelect(data.url, data.type);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    if (onRemove) {
      onRemove();
    }
    setError('');
  };

  const isImage = selectedMedia?.startsWith('data:image');
  const isVideo = selectedMedia?.startsWith('data:video');

  return (
    <div className="media-picker">
      {selectedMedia ? (
        <div className="media-preview">
          {isImage && <img src={selectedMedia} alt="Uploaded media" className="media-preview-image" />}
          {isVideo && (
            <video src={selectedMedia} controls className="media-preview-video">
              Your browser does not support video.
            </video>
          )}
          <button onClick={handleRemove} className="media-remove-button" aria-label="Remove media">
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="media-upload-zone">
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="media-file-input"
            aria-label="Upload media"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="media-upload-button"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
            {uploading ? 'Uploading...' : 'Add media'}
          </button>
          <span className="media-upload-hint">Images and videos up to {maxFileSize / 1024 / 1024}MB</span>
        </div>
      )}
      {error && <p className="media-error" role="alert">{error}</p>}
    </div>
  );
}
