"use client";

import { useCallback, useState } from "react";

import { MediaAttachmentFields } from "@/components/media-attachment-fields";
import { MediaFocalPointEditor } from "@/components/media-focal-point-editor";

type MediaAlignmentUploadProps = {
  currentSrc: string | null;
  alt: string;
  shape: "circle" | "banner";
  mediaContext: "avatars" | "custom-page";
  fieldName: string;
  xName: string;
  yName: string;
  defaultX: number;
  defaultY: number;
};

export function effectiveAlignmentPreview(
  currentSrc: string | null,
  pendingSrc: string | null,
) {
  return pendingSrc ?? currentSrc;
}

export function MediaAlignmentUpload({
  currentSrc,
  alt,
  shape,
  mediaContext,
  fieldName,
  xName,
  yName,
  defaultX,
  defaultY,
}: MediaAlignmentUploadProps) {
  const [pendingSrc, setPendingSrc] = useState<string | null>(null);
  const handleReadyPreview = useCallback((previewUrl: string | null) => {
    setPendingSrc(previewUrl);
  }, []);
  const previewSrc = effectiveAlignmentPreview(currentSrc, pendingSrc);

  return (
    <div>
      <MediaAttachmentFields
        mediaContext={mediaContext}
        maxFiles={1}
        compact
        fieldName={fieldName}
        onPrimaryReadyPreviewChange={handleReadyPreview}
      />
      {previewSrc ? (
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          {pendingSrc ? (
            <p
              className="mb-3 text-[12px] font-semibold text-[hsl(var(--primary-bright))]"
              aria-live="polite"
            >
              New upload ready — drag it into position before saving.
            </p>
          ) : null}
          <MediaFocalPointEditor
            src={previewSrc}
            alt={alt}
            shape={shape}
            xName={xName}
            yName={yName}
            defaultX={defaultX}
            defaultY={defaultY}
          />
        </div>
      ) : null}
    </div>
  );
}
