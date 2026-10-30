// The social path carries the artifact, never a reader capability. Image and
// video shares pass files (plus a title) and nothing else: url and text are
// deliberately absent, because a link riding in a share sheet can end up in a
// public post. scripts/check-social-share.mjs fails if a files payload ever
// grows either key, and every files call site must route through this builder.
export interface ArtifactSharePayload {
  files: File[];
  title?: string;
}
export function artifactSharePayload(files: File[], title?: string): ArtifactSharePayload {
  return title ? { files, title } : { files };
}
// Single gate for offering the native share sheet: the runtime capability
// probe, never a user-agent or version sniff. Desktop Chromium gains file
// sharing by reporting it here, and download stays the fallback elsewhere.
export function shareSheetAvailable(files: File[]): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files });
}
