// Pure MediaRecorder mime-type selection. Takes an isTypeSupported
// function (or a stub in tests) and returns the best type the browser
// claims to support. Order matters: VP9 WebM first, then VP8 WebM,
// then plain WebM, then MP4 as a last resort (Safari's MediaRecorder
// historically only offers MP4). Empty support falls back to "" —
// passing "" to MediaRecorder means "use the browser default".

export const MIME_CANDIDATES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4',
];

export function pickMimeType(isTypeSupported) {
  if (typeof isTypeSupported !== 'function') return '';
  for (const candidate of MIME_CANDIDATES) {
    try {
      if (isTypeSupported(candidate)) return candidate;
    } catch {
      // A throwing isTypeSupported is treated as "not supported" for
      // that candidate, never as a crash.
    }
  }
  return '';
}

// The file extension that matches a mime type. Unknown types get .webm
// because that is what most browsers actually produce.
export function extensionForMime(mime) {
  if (typeof mime === 'string' && mime.includes('mp4')) return 'mp4';
  return 'webm';
}
