// Pure time formatting for Screenly. No DOM, no timers — main.js owns
// the interval; this module only turns milliseconds into text.

function pad(n) {
  return String(n).padStart(2, '0');
}

// Elapsed time with tenths, e.g. 0 -> "00:00:00.0", 61000 -> "00:01:01.0",
// 3661000 -> "01:01:01.0". Negative or non-finite input is treated as 0.
export function formatElapsed(ms) {
  const safe = Number.isFinite(ms) && ms > 0 ? Math.floor(ms) : 0;
  const tenths = Math.floor((safe % 1000) / 100);
  const totalSeconds = Math.floor(safe / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${tenths}`;
}

// Whole-second duration for the recordings list, e.g. 61 -> "00:01:01".
// Hours are not capped, so a very long recording reads "02:14:09".
export function formatDuration(totalSeconds) {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const seconds = safe % 60;
  const minutes = Math.floor(safe / 60) % 60;
  const hours = Math.floor(safe / 3600);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
