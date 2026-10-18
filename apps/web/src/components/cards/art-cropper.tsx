'use client';

import Cropper from 'react-easy-crop';
import { useCallback, useState } from 'react';
import { cropImage, type PixelCrop } from '@/lib/crop-image';
import { Button } from '@/components/ui/button';
import { Window } from '@/components/ui/window';

const CARD_ASPECT = 1024 / 1434;

interface ArtCropperProps {
  readonly imageSrc: string;
  readonly onConfirm: (croppedBlob: Blob, previewUrl: string) => void;
  readonly onCancel: () => void;
}

export function ArtCropper({ imageSrc, onConfirm, onCancel }: ArtCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<PixelCrop | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_: unknown, pixels: PixelCrop) => {
    setCroppedArea(pixels);
  }, []);

  const confirm = async () => {
    if (!croppedArea) return;
    setSaving(true);
    try {
      const blob = await cropImage(imageSrc, croppedArea);
      const url = URL.createObjectURL(blob);
      onConfirm(blob, url);
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/80 p-4">
      <Window className="flex w-full max-w-lg flex-col gap-4 p-5">
        <h3 className="text-center font-display text-lg font-bold tracking-wider text-cream">
          Crop art
        </h3>

        <div className="relative aspect-[5/7] w-full overflow-hidden rounded-md bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={CARD_ASPECT}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-300/70">Zoom</label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-action"
          />
        </div>

        <div className="flex gap-3">
          <Button className="flex-1" onClick={() => void confirm()} disabled={saving}>
            {saving ? 'Cropping…' : 'Apply'}
          </Button>
          <Button variant="secondary" className="flex-1" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </Window>
    </div>
  );
}
