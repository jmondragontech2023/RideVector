/** Browser-only GPX download helpers. Keep serialization in `gpx.ts`. */

export const GPX_MIME_TYPE = 'application/gpx+xml';

export type GpxDownloadDependencies = {
  document: Pick<Document, 'createElement' | 'body'>;
  URL: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>;
  Blob: typeof Blob;
};

const defaultDependencies = (): GpxDownloadDependencies => ({
  document,
  URL,
  Blob,
});

/**
 * Triggers a file download for a GPX document and always revokes the object URL.
 */
export function downloadGpxFile(
  xml: string,
  filename: string,
  deps: GpxDownloadDependencies = defaultDependencies(),
): void {
  const blob = new deps.Blob([xml], { type: `${GPX_MIME_TYPE};charset=utf-8` });
  const objectUrl = deps.URL.createObjectURL(blob);
  const anchor = deps.document.createElement('a');

  try {
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    deps.document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    deps.URL.revokeObjectURL(objectUrl);
  }
}
