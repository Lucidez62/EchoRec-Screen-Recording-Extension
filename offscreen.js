// offscreen.js - Handles all media capture and processing.

let recorder = null;
let recordedChunks = [];
let micStream = null;
let currentStream = null;

chrome.runtime.onMessage.addListener(handleMessages);

async function handleMessages(request) {
  switch (request.action) {
    case "OFFSCREEN_START_RECORDING":
      try {
        const stream = await getVideoStream(request.options);
        startRecorder(stream);
      } catch (error) {
        console.error("Error starting capture in offscreen:", error.message);
        updateState({ isRecording: false, isPaused: false });
      }
      break;
    case "OFFSCREEN_STOP_RECORDING":
      stopRecorder();
      break;
    case "OFFSCREEN_PAUSE_RECORDING":
      if (recorder && recorder.state === 'recording') {
        recorder.pause();
        updateState({ isPaused: true });
      }
      break;
    case "OFFSCREEN_RESUME_RECORDING":
      if (recorder && recorder.state === 'paused') {
        recorder.resume();
        updateState({ isPaused: false });
      }
      break;
  }
}

async function getVideoStream({ withMic }) {
  let mediaStream;

  // Use getDisplayMedia which allows the user to select screen, window, or tab.
  mediaStream = await navigator.mediaDevices.getDisplayMedia({
    video: { cursor: "always" },
    audio: true, // Allow user to capture audio from the selected tab/screen.
  });

  if (withMic) {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Add the microphone track to the stream.
    // This allows recording both tab/system audio and microphone audio together.
    micStream.getAudioTracks().forEach(track => mediaStream.addTrack(track));
  }

  // Set a handler for when the user stops sharing via the browser's native UI
  mediaStream.getVideoTracks()[0].onended = stopRecorder;
  return mediaStream;
}

function startRecorder(stream) {
  if (recorder && recorder.state !== 'inactive') return;
  
  currentStream = stream;
  recordedChunks = [];
  recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp8,opus' });

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  recorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const sanitizedDate = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const filename = `recording-${sanitizedDate}.webm`;

    // Send the ready-to-download URL to the background script
    chrome.runtime.sendMessage({
      action: 'DOWNLOAD_FILE',
      url: url,
      filename: filename
    });

    cleanUp();
  };

  recorder.start();
  updateState({ isRecording: true, isPaused: false, startTime: Date.now() });
}

function stopRecorder() {
  if (recorder && recorder.state !== 'inactive') {
    recorder.stop();
  }
}

function cleanUp() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
  }
  if (micStream) {
    micStream.getTracks().forEach(track => track.stop());
  }
  recorder = null;
  currentStream = null;
  micStream = null;
  recordedChunks = [];
  updateState({ isRecording: false, isPaused: false, startTime: null });
}

// Utility to keep the popup and storage in sync
function updateState(newState) {
  chrome.storage.local.set(newState);
  chrome.runtime.sendMessage({ action: "STATE_UPDATED", state: newState }).catch(() => {});
}