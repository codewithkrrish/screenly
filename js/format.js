// Pure naming, size and audio-choice helpers for Screenly. No DOM.

export function pad2(n) {
  return String(n).padStart(2, '0');
}

// "screenly-recording-20261029-110830.webm". The timestamp is local
// time (year month day - hour minute second), so filenames sort in
// recording order and never contain characters illegal on Windows.
export function recordingFileName(date, extension = 'webm') {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const ext = typeof extension === 'string' && extension.replace(/[^a-z0-9]/gi, '') ? extension.replace(/[^a-z0-9]/gi, '') : 'webm';
  return `screenly-recording-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}.${ext}`;
}

// Human byte sizes: 0 -> "0 B", 1536 -> "1.5 KB", 1.5MB and 2.4GB
// likewise. Values below 1024 stay in bytes with no decimals.
export function formatBytes(bytes) {
  const safe = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (safe < 1024) return `${Math.floor(safe)} B`;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = safe;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

// Countdown ticks for an optional pre-recording countdown:
// countdownValues(3) -> [3, 2, 1]. 0 or invalid means "no countdown".
export function countdownValues(seconds) {
  const n = Number.isFinite(seconds) ? Math.floor(seconds) : 0;
  if (n <= 0) return [];
  const out = [];
  for (let i = n; i >= 1; i -= 1) out.push(i);
  return out;
}

// Which audio tracks a recording should request, from the user's
// audio-source choice and the mic toggle. The browser picker decides
// what system audio actually means (see the honest notes in the UI):
// Chrome shares tab audio only when a tab is shared, and some
// browsers offer no system audio at all — in that case the display
// stream simply has no audio track and the recording stays silent
// on that channel rather than failing.
export function effectiveAudio({ source, micOn }) {
  const mic = micOn !== false;
  switch (source) {
    case 'system':
      return { displayAudio: true, includeMic: false };
    case 'mic':
      return { displayAudio: false, includeMic: mic };
    case 'both':
      return { displayAudio: true, includeMic: mic };
    case 'none':
    default:
      return { displayAudio: false, includeMic: false };
  }
}
