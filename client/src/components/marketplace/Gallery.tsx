import type { ThemeTokens, PublishedAsset } from "@/types/brandScanner";
import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GalleryProps {
  tokens: ThemeTokens;
  assets: PublishedAsset[];
  columns?: 2 | 3 | 4;
}

export function Gallery({ tokens, assets, columns = 3 }: GalleryProps) {
  const [selectedImage, setSelectedImage] = useState<PublishedAsset | null>(null);

  // Filter to only show images
  const imageAssets = assets.filter((asset) => asset.type === "image");

  const gridClass = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  }[columns];

  return (
    <>
      <div
        data-testid="marketplace-gallery"
        className={`grid ${gridClass} gap-4`}
      >
        {imageAssets.map((asset, index) => (
          <button
            key={asset.hash}
            data-testid={`gallery-item-${index}`}
            onClick={() => setSelectedImage(asset)}
            className="relative aspect-square overflow-hidden rounded-md group cursor-pointer"
            style={{ borderColor: tokens.border.hex }}
          >
            <img
              src={asset.cdnUrl}
              alt={`Gallery image ${index + 1}`}
              className="w-full h-full object-cover transition-transform group-hover:scale-110"
              loading="lazy"
            />
            <div
              className="absolute inset-0 bg-black opacity-0 group-hover:opacity-20 transition-opacity"
              aria-hidden="true"
            />
          </button>
        ))}
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          data-testid="gallery-lightbox"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <Button
            size="icon"
            variant="ghost"
            data-testid="button-close-lightbox"
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 text-white hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </Button>

          <img
            src={selectedImage.cdnUrl}
            alt="Enlarged gallery image"
            data-testid="lightbox-image"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
