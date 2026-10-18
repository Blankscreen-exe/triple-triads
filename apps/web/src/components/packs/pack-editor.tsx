'use client';

import { useRef, useState, useTransition } from 'react';
import {
  IMAGE_PARTS,
  PACK_FONT_EXTENSIONS,
  PACK_IMAGE_TYPES,
  PART_FILE_NAMES,
  templateUrl,
  type PackPart,
} from '@/lib/asset-pack-spec';
import type { AssetPack } from '@/lib/asset-packs';
import { CardBack, CardView, type CardFace } from '../cards/card-view';
import { Button } from '../ui/button';
import { Window } from '../ui/window';

export type PackActionResult =
  { readonly ok: true } | { readonly ok: false; readonly error: string };

interface PackEditorProps {
  readonly pack: AssetPack;
  /** Parts replaced in this pack (the rest come from the default). */
  readonly replaced: readonly PackPart[];
  /** Server actions; the server decides whose pack they change. */
  readonly upload: (formData: FormData) => Promise<PackActionResult>;
  readonly reset: (part: PackPart) => Promise<PackActionResult>;
}

const SAMPLE: CardFace = {
  name: 'Sky Wyrm',
  stats: { top: 10, right: 4, bottom: 6, left: 9 },
  element: 'wind',
  stars: 5,
  artUrl: null,
};

export function PackEditor({ pack, replaced, upload, reset }: PackEditorProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-3">
        {IMAGE_PARTS.map((spec) => (
          <PartRow
            key={spec.part}
            part={spec.part}
            label={spec.label}
            description={`${spec.description} PNG or WebP, exactly ${String(spec.width)} × ${String(spec.height)}.`}
            accept={PACK_IMAGE_TYPES.join(',')}
            previewUrl={pack.images[spec.part]}
            expectedSize={[spec.width, spec.height]}
            downloads={[
              ...spec.templates.map((template) => ({
                label: template.label,
                href: templateUrl(template),
                fileName: template.file,
              })),
              {
                label: 'Current image',
                href: pack.images[spec.part],
                fileName: `${PART_FILE_NAMES[spec.part]}.png`,
              },
            ]}
            isReplaced={replaced.includes(spec.part)}
            upload={upload}
            reset={reset}
          />
        ))}
        <PartRow
          part="font"
          label="Name font"
          description="Used for card names. TTF, OTF or WOFF2, up to 2 MB."
          accept={PACK_FONT_EXTENSIONS.join(',')}
          previewUrl={null}
          downloads={
            pack.font
              ? [
                  {
                    label: 'Current font',
                    href: pack.font.url,
                    fileName: `font${pack.font.url.slice(pack.font.url.lastIndexOf('.'))}`,
                  },
                ]
              : []
          }
          isReplaced={replaced.includes('font')}
          upload={upload}
          reset={reset}
        />
      </div>
      <Window className="space-y-4 p-5 lg:sticky lg:top-20 lg:self-start" aria-label="Preview">
        <h2 className="font-display text-lg font-bold tracking-wider text-cream">Preview</h2>
        <div className="grid grid-cols-3 gap-3">
          <CardView card={SAMPLE} side="blue" pack={pack} />
          <CardView card={SAMPLE} side="red" pack={pack} />
          <CardBack pack={pack} />
        </div>
        <p className="text-xs text-slate-300/80">
          Measurement templates for every part are on the{' '}
          <a className="underline" href="/templates">
            templates page
          </a>
          .
        </p>
      </Window>
    </div>
  );
}

function PartRow({
  part,
  label,
  description,
  accept,
  previewUrl,
  expectedSize,
  downloads,
  isReplaced,
  upload,
  reset,
}: {
  readonly part: PackPart;
  readonly label: string;
  readonly description: string;
  readonly accept: string;
  readonly previewUrl: string | null;
  readonly expectedSize?: readonly [number, number];
  /** Files to start from: templates at the exact size, and the file currently in use. */
  readonly downloads: readonly Download[];
  readonly isReplaced: boolean;
  readonly upload: PackEditorProps['upload'];
  readonly reset: PackEditorProps['reset'];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const submit = async (file: File) => {
    if (expectedSize) {
      const sizeError = await checkImageSize(file, expectedSize);
      if (sizeError) {
        setError(sizeError);
        return;
      }
    }
    const data = new FormData();
    data.set('part', part);
    data.set('file', file);
    startTransition(async () => {
      const result = await upload(data);
      setError(result.ok ? null : result.error);
      if (input.current) input.current.value = '';
    });
  };

  return (
    <Window className="flex flex-wrap items-center gap-4 p-4" aria-label={label}>
      {previewUrl && (
        <div
          aria-hidden
          className="h-16 w-24 shrink-0 rounded border border-frame/30 bg-black/30 bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${JSON.stringify(previewUrl)})` }}
        />
      )}
      <div className="min-w-48 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-100">{label}</span>
          <span
            className={`rounded-sm px-1.5 py-0.5 text-[10px] tracking-wider uppercase ${isReplaced ? 'bg-action' : 'bg-black/40'}`}
          >
            {isReplaced ? 'Custom' : 'Default'}
          </span>
        </div>
        <p className="text-xs text-slate-300/80">{description}</p>
        {downloads.length > 0 && (
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="text-slate-400">Download:</span>
            {downloads.map((download) => (
              <a
                key={download.label}
                href={download.href}
                download={download.fileName}
                aria-label={`Download ${download.label.toLowerCase()} for ${label}`}
                className="text-cream underline decoration-cream/40 underline-offset-2 hover:decoration-cream"
              >
                {download.label}
              </a>
            ))}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-1 text-sm text-status-live">
            {error}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <label className="cursor-pointer">
          <span className="sr-only">Upload {label}</span>
          <input
            ref={input}
            type="file"
            accept={accept}
            disabled={isPending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void submit(file);
            }}
            className="block w-52 text-xs text-slate-200 file:mr-2 file:rounded-md file:border file:border-frame/60 file:bg-black/25 file:px-2 file:py-1 file:text-slate-100"
          />
        </label>
        {isReplaced && (
          <Button
            variant="quiet"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                const result = await reset(part);
                setError(result.ok ? null : result.error);
              });
            }}
          >
            Use default
          </Button>
        )}
      </div>
    </Window>
  );
}

interface Download {
  readonly label: string;
  readonly href: string;
  /** Suggested file name when saved. */
  readonly fileName: string;
}

/** Checks an image's pixel size in the browser before uploading it. */
async function checkImageSize(
  file: File,
  [width, height]: readonly [number, number],
): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const ok = bitmap.width === width && bitmap.height === height;
    const actual = `${String(bitmap.width)} × ${String(bitmap.height)}`;
    bitmap.close();
    return ok
      ? null
      : `This image is ${actual}; it must be exactly ${String(width)} × ${String(height)}.`;
  } catch {
    return 'That file is not an image this browser can read.';
  }
}
