/** Browser-only GPX download helpers. Keep serialization in `gpx.ts`. */

export const GPX_MIME_TYPE = 'application/gpx+xml';

/**
 * Safari/WebKit often starts the blob download asynchronously after the
 * synthetic click. Revoking immediately can yield empty or dropped files.
 */
export const GPX_OBJECT_URL_REVOKE_DELAY_MS = 1_000;

export type GpxDownloadDependencies = {
  document: Pick<Document, 'createElement' | 'body'>;
  URL: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>;
  Blob: typeof Blob;
  setTimeoutFn?: typeof setTimeout;
};

const defaultDependencies = (): GpxDownloadDependencies => ({
  document,
  URL,
  Blob,
});

/**
 * Triggers a file download for a GPX document and revokes the object URL after
 * a short delay so WebKit can finish reading the blob.
 */
export function downloadGpxFile(
  xml: string,
  filename: string,
  deps: GpxDownloadDependencies = defaultDependencies(),
): void {
  const blob = new deps.Blob([xml], { type: `${GPX_MIME_TYPE};charset=utf-8` });
  const objectUrl = deps.URL.createObjectURL(blob);
  const anchor = deps.document.createElement('a');
  const schedule = deps.setTimeoutFn ?? setTimeout;

  try {
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    deps.document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    schedule(() => {
      deps.URL.revokeObjectURL(objectUrl);
    }, GPX_OBJECT_URL_REVOKE_DELAY_MS);
  }
}
