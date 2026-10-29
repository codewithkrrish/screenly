// DOM wiring for Screenly only. Timer formatting lives in timer.js,
// mime-type selection in mime.js, the state machine in state.js, and
// naming / size / audio-choice helpers in format.js. This module never
// formats a time, picks a mime type, or decides a transition itself —
// it only wires controls to those modules and to the browser's
// getDisplayMedia / MediaRecorder APIs.

import { formatElapsed, formatDuration } from './timer.js';
import { pickMimeType, extensionForMime } from './mime.js';
import { createRecorderState, transition, isLive } from './state.js';
import { recordingFileName, formatBytes, countdownValues, effectiveAudio } from './format.js';

const $ = (id) => document.getElementById(id);

// Resolve browser APIs through window when it exists (real browser,
// and the jsdom harness which installs stubs on window before import).
function browserApis() {
  const win = typeof window !== 'undefined' ? window : globalThis;
  const nav = (win && win.navigator) || globalThis.navigator || {};
  return {
    mediaDevices: nav.mediaDevices || null,
    MediaRecorder: (win && win.MediaRecorder) || globalThis.MediaRecorder || null,
    URL: (win && win.URL) || globalThis.URL,
  };
}

const recorderState = createRecorderState();
let state = recorderState.state;
let displayStream = null;
let micStream = null;
let recorder = null;
let chunks = [];
let chunkBytes = 0;
let timerInterval = null;
let countdownInterval = null;
let startedAt = 0;
let accumulatedMs = 0;
let currentRecording = null; // latest finished recording, shown in preview
let recordings = []; // session list; preview and download share each blob
let supported = false;
let starting = false; // capture setup in flight (picker open); blocks re-start

function setState(next) {
  const result = transition(state, next);
  if (!result.ok) return false;
  state = result.state;
  return true;
}

function elapsedNow() {
  if (state === 'recording') return accumulatedMs + (Date.now() - startedAt);
  return accumulatedMs;
}

function renderTimer() {
  $('timerText').textContent = formatElapsed(elapsedNow());
  $('sizeText').textContent = formatBytes(chunkBytes);
  $('timerStateText').textContent = state === 'recording'
    ? 'Recording'
    : state === 'paused'
      ? 'Paused'
      : state === 'countdown'
        ? 'Get ready'
        : state === 'stopped'
          ? 'Stopped'
          : 'Ready';
  $('recDot').hidden = state !== 'recording';
}

function syncUI() {
  const { MediaRecorder } = browserApis();
  $('startBtn').disabled = starting || !supported || !(state === 'idle' || state === 'stopped');
  $('pauseBtn').disabled = state !== 'recording';
  $('resumeBtn').disabled = state !== 'paused';
  $('stopBtn').disabled = !(state === 'recording' || state === 'paused');
  $('cancelCountdownBtn').hidden = state !== 'countdown';
  $('countdownText').hidden = state !== 'countdown';
  $('startBtn').textContent = state === 'stopped' ? 'Record again' : 'Start recording';
  if (typeof MediaRecorder === 'undefined' || MediaRecorder === null) {
    $('startBtn').disabled = true;
  }
  renderTimer();
}

function setStatus(text) {
  $('statusText').textContent = text;
}

function stopTimer() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function startTimer() {
  stopTimer();
  timerInterval = setInterval(renderTimer, 100);
}

function stopCountdown() {
  if (countdownInterval !== null) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function stopAllTracks() {
  for (const stream of [displayStream, micStream]) {
    if (stream && typeof stream.getTracks === 'function') {
      for (const track of stream.getTracks()) {
        try { track.stop(); } catch { /* already stopped */ }
      }
    }
  }
  displayStream = null;
  micStream = null;
}

function resetCaptureState() {
  stopTimer();
  stopCountdown();
  stopAllTracks();
  recorder = null;
  chunks = [];
  chunkBytes = 0;
  accumulatedMs = 0;
  startedAt = 0;
}

function renderRecordingsList() {
  const list = $('recordingsList');
  list.textContent = '';
  for (const rec of recordings) {
    const item = document.createElement('div');
    item.className = 'recording-item';
    const meta = document.createElement('span');
    meta.className = 'recording-meta';
    meta.textContent = `${rec.filename} — ${formatDuration(Math.round(rec.durationMs / 1000))} — ${formatBytes(rec.size)}`;
    const previewBtn = document.createElement('button');
    previewBtn.type = 'button';
    previewBtn.className = 'btn secondary';
    previewBtn.textContent = 'Preview';
    previewBtn.addEventListener('click', () => showPreview(rec));
    const download = document.createElement('a');
    download.className = 'btn secondary';
    download.href = rec.url;
    download.download = rec.filename;
    download.textContent = 'Download';
    item.append(meta, previewBtn, download);
    list.appendChild(item);
  }
  $('recordingCountText').textContent = recordings.length === 0
    ? 'No recordings yet this session.'
    : `${recordings.length} recording${recordings.length === 1 ? '' : 's'} this session.`;
}

function showPreview(rec) {
  currentRecording = rec;
  const video = $('previewVideo');
  video.src = rec.url;
  $('previewNameText').textContent = rec.filename;
  $('previewMetaText').textContent = `${formatDuration(Math.round(rec.durationMs / 1000))} — ${formatBytes(rec.size)} — ${rec.mime || 'browser default format'}`;
  const download = $('downloadBtn');
  download.href = rec.url;
  download.download = rec.filename;
  $('previewWrap').hidden = false;
  $('previewEmptyNote').hidden = true;
}

function clearPreview() {
  currentRecording = null;
  const video = $('previewVideo');
  video.removeAttribute('src');
  video.load && video.load();
  $('previewWrap').hidden = true;
  $('previewEmptyNote').hidden = false;
  $('previewNameText').textContent = '';
  $('previewMetaText').textContent = '';
}

function finishRecording() {
  const { URL } = browserApis();
  stopTimer();
  const blob = new Blob(chunks, { type: recorder && recorder.mimeType ? recorder.mimeType : '' });
  const mime = blob.type || (recorder && recorder.mimeType) || '';
  const url = URL.createObjectURL(blob);
  const rec = {
    filename: recordingFileName(new Date(), extensionForMime(mime)),
    mime,
    blob,
    url,
    durationMs: accumulatedMs,
    size: blob.size,
  };
  recordings.push(rec);
  renderRecordingsList();
  showPreview(rec);
  setState('stopped');
  setStatus(`Recording saved — ${rec.filename} (${formatDuration(Math.round(rec.durationMs / 1000))}, ${formatBytes(rec.size)}). Watch it above or download it.`);
  stopAllTracks();
  recorder = null;
  chunks = [];
  chunkBytes = 0;
  syncUI();
}

async function beginCapture() {
  starting = true;
  syncUI();
  const { mediaDevices, MediaRecorder, URL } = browserApis();
  const audio = effectiveAudio({ source: $('audioSourceSelect').value, micOn: $('micToggle').checked });
  const frameRate = Number($('frameRateSelect').value) || 30;
  const bitrate = Number($('bitrateSelect').value) || 5000000;
  try {
    displayStream = await mediaDevices.getDisplayMedia({
      video: { frameRate },
      audio: audio.displayAudio,
    });
  } catch (err) {
    // Picker cancelled or permission denied: back to ready, no spinner,
    // nothing half-recorded. Any error here means "no capture".
    resetCaptureState();
    starting = false;
    setState('idle');
    setStatus('Screen sharing was cancelled or permission was denied. Nothing was recorded — press Start recording again when you are ready.');
    syncUI();
    return;
  }
  if (audio.includeMic) {
    try {
      micStream = await mediaDevices.getUserMedia({ audio: true });
    } catch {
      micStream = null;
      setStatus('Microphone permission was denied, so this recording will have no mic audio. Screen capture is still running — press Stop when you are done.');
    }
  }
  let combined = displayStream;
  if (micStream && typeof displayStream.getTracks === 'function' && typeof micStream.getAudioTracks === 'function') {
    const tracks = [...displayStream.getTracks(), ...micStream.getAudioTracks()];
    combined = typeof MediaStream !== 'undefined' ? new MediaStream(tracks) : displayStream;
  }
  const mime = pickMimeType(
    MediaRecorder && typeof MediaRecorder.isTypeSupported === 'function'
      ? MediaRecorder.isTypeSupported.bind(MediaRecorder)
      : null,
  );
  const options = { videoBitsPerSecond: bitrate };
  if (mime) options.mimeType = mime;
  try {
    recorder = new MediaRecorder(combined, options);
  } catch {
    resetCaptureState();
    starting = false;
    setState('idle');
    setStatus('This browser could not start a recorder with the chosen settings. Try a different quality setting, or a current version of Chrome, Edge or Firefox.');
    syncUI();
    return;
  }
  chunks = [];
  chunkBytes = 0;
  accumulatedMs = 0;
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
      chunkBytes += event.data.size;
      renderTimer();
    }
  };
  recorder.onstop = () => finishRecording();
  // If the user presses "Stop sharing" in the browser's own bar, end
  // the recording the same way as Stop here.
  if (typeof displayStream.getVideoTracks === 'function') {
    for (const track of displayStream.getVideoTracks()) {
      track.addEventListener && track.addEventListener('ended', () => {
        if (recorder && state === 'recording') {
          try { recorder.stop(); } catch { /* already stopped */ }
        }
      });
    }
  }
  try {
    recorder.start(250);
  } catch {
    resetCaptureState();
    starting = false;
    setState('idle');
    setStatus('Recording could not start. Press Start recording again.');
    syncUI();
    return;
  }
  startedAt = Date.now();
  starting = false;
  setState('recording');
  setStatus('Recording. Press Pause to pause, Stop to finish, or stop sharing from your browser bar.');
  startTimer();
  syncUI();
}

function startRecording() {
  if (!supported) return;
  if (!(state === 'idle' || state === 'stopped')) return;
  const seconds = Number($('countdownSelect').value) || 0;
  const ticks = countdownValues(seconds);
  if (ticks.length === 0) {
    beginCapture();
    return;
  }
  if (!setState('countdown')) return;
  let index = 0;
  $('countdownText').textContent = String(ticks[index]);
  syncUI();
  stopCountdown();
  countdownInterval = setInterval(() => {
    index += 1;
    if (index >= ticks.length) {
      stopCountdown();
      setState('idle');
      beginCapture();
      return;
    }
    $('countdownText').textContent = String(ticks[index]);
  }, 1000);
}

function pauseRecording() {
  if (state !== 'recording' || !recorder) return;
  try { recorder.pause(); } catch { /* ignore */ }
  accumulatedMs += Date.now() - startedAt;
  stopTimer();
  setState('paused');
  setStatus('Paused. Press Resume to continue or Stop to finish this recording.');
  syncUI();
}

function resumeRecording() {
  if (state !== 'paused' || !recorder) return;
  try { recorder.resume(); } catch { /* ignore */ }
  startedAt = Date.now();
  setState('recording');
  setStatus('Recording. Press Pause to pause, Stop to finish.');
  startTimer();
  syncUI();
}

function stopRecording() {
  if (!(state === 'recording' || state === 'paused') || !recorder) return;
  if (state === 'recording') accumulatedMs += Date.now() - startedAt;
  try { recorder.stop(); } catch { /* already stopped */ }
  // finishRecording runs from recorder.onstop; if a stub recorder
  // never fires it, the state below keeps the UI honest.
  if (recorder && typeof recorder.onstop !== 'function') {
    finishRecording();
  }
}

function discardCurrent() {
  if (currentRecording) {
    const { URL } = browserApis();
    try { URL.revokeObjectURL(currentRecording.url); } catch { /* ignore */ }
    recordings = recordings.filter((rec) => rec !== currentRecording);
    renderRecordingsList();
  }
  clearPreview();
  resetCaptureState();
  setState('idle');
  setStatus('Discarded. Ready to record again.');
  syncUI();
}

function keepAndRecordAnother() {
  clearPreview();
  resetCaptureState();
  setState('idle');
  setStatus('Kept in the session list below. Ready to record again.');
  syncUI();
}

function init() {
  const { mediaDevices, MediaRecorder } = browserApis();
  supported = !!(
    mediaDevices
    && typeof mediaDevices.getDisplayMedia === 'function'
    && typeof MediaRecorder === 'function'
  );
  if (!supported) {
    $('compatNote').hidden = false;
    setStatus('Screen recording is not available in this browser.');
  }
  $('startBtn').addEventListener('click', startRecording);
  $('pauseBtn').addEventListener('click', pauseRecording);
  $('resumeBtn').addEventListener('click', resumeRecording);
  $('stopBtn').addEventListener('click', stopRecording);
  $('discardBtn').addEventListener('click', discardCurrent);
  $('newBtn').addEventListener('click', keepAndRecordAnother);
  $('cancelCountdownBtn').addEventListener('click', () => {
    stopCountdown();
    setState('idle');
    $('countdownText').textContent = '';
    setStatus('Countdown cancelled. Ready when you are.');
    syncUI();
  });
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return;
    const target = e.target;
    const tag = target && target.tagName ? target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    if (state === 'recording') {
      e.preventDefault();
      pauseRecording();
    } else if (state === 'paused') {
      e.preventDefault();
      resumeRecording();
    }
  });
  // Settings only take effect on the next recording; changing them
  // mid-session never disturbs a running recorder.
  $('audioSourceSelect').addEventListener('change', () => {
    if (!isLive(state)) setStatus('Audio setting saved for the next recording.');
  });
  renderRecordingsList();
  syncUI();
}

init();
