# Screenly

I built Screenly because every time I wanted to record my screen for a
tutorial or a bug report, the options were either a download, a signup,
or a tool that uploaded the recording somewhere. This one does none of
that: open the page, pick a screen, window or tab, and record. The file
stays on your device.

## What it does

- Screen capture through your browser's own picker — share a whole
  screen, a window, or a single tab. Recording starts only after you
  confirm the pick.
- Audio source choice: system audio (if the browser offers it),
  microphone only, both, or none, plus a mic on/off toggle. The mic
  track is mixed into the same recording as the screen.
- Full recording controls: Start, Pause, Resume, Stop, with a live
  timer (HH:MM:SS plus tenths), a pulsing recording indicator, a
  clear paused state, and a running size estimate.
- After you stop: a preview player for the clip, a download button,
  a discard-and-re-record option, and a session list of every
  recording made in this tab, each with duration, size, and its own
  download button. Preview and download are the same recording.
- Quality controls that actually matter: bitrate at 2.5, 5 or 8 Mbps,
  a frame-rate hint (15, 30 or 60 fps), and an optional 3- or
  5-second countdown before recording starts.
- Keyboard shortcut: Space pauses or resumes while recording (it
  does nothing while you are typing in a field).
- A "How it works" strip and plain-language notes on the page, so
  nobody has to guess what will happen when they press Start.

## Honest limitations

- The download is a .webm file in most browsers — MediaRecorder does
  not produce MP4 directly, except on Safari, which may. If you need
  MP4, convert with a desktop tool: `ffmpeg -i
  screenly-recording.webm screenly-recording.mp4`.
- System audio is the weakest part, and it is the browser's doing,
  not the page's. Chrome and Edge can capture audio from a shared
  tab; sharing a whole screen often captures no system audio at all.
  If a recording comes back silent, share the tab itself.
- If you cancel the browser picker or deny permission, nothing is
  recorded and the page returns to its ready state — that is by
  design, but it also means a cancelled pick is not recoverable; you
  just press Start again.
- Recordings live only in the open tab. Close or refresh the page and
  they are gone, so download anything you want to keep before you
  leave. Very long recordings at 8 Mbps and 60 fps make large files;
  the standard 5 Mbps / 30 fps default is the sensible choice for
  most machines.
- Older browsers, and any browser without getDisplayMedia or
  MediaRecorder, show a compatibility note and disable recording
  instead of failing halfway through.

## How it is put together

Vanilla JavaScript ES modules, no build step, no dependencies, no
tracking. `js/timer.js` formats elapsed time and durations,
`js/mime.js` picks the best MediaRecorder mime type the browser
supports, `js/state.js` is the recording state machine (illegal
transitions are refused, never crashes), `js/format.js` holds file
naming, byte sizes, countdown ticks and the audio-source decision,
and `js/main.js` only wires the DOM to the browser capture APIs.
Open `index.html` in any modern browser and it just works.

## Privacy

Your recordings are processed locally in your browser and never
uploaded. There is no server, no storage, and nothing to sign up for.
