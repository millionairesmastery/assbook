"use client";
import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

// A photo, large, over everything. Escape, the close button, or a tap on the
// backdrop puts it away.
export function PhotoLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="lightbox-backdrop" />
        <DialogPrimitive.Content className="lightbox" aria-label={alt}>
          <DialogPrimitive.Title className="sr-only">{alt}</DialogPrimitive.Title>
          <img src={src} alt={alt} decoding="async" />
          <DialogPrimitive.Close className="lightbox-close" aria-label="Close photo">
            <X size={20} aria-hidden="true" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
