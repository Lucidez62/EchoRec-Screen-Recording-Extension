/* popup.js - UI controller that sends messages to the background service worker. */

let isMinimized = false;

// DOM elements
const minimizeBtn = document.getElementById('minimizeBtn');
const minimizeIcon = document.getElementById('minimizeIcon');
const body = document.body;
const container = document.querySelector('.container');
const title = document.getElementById('title');
const description = document.getElementById('description');
const mainButtonContainer = document.getElementById('mainButtonContainer');
const secondaryActions = document.getElementById('secondaryActions');
const micControl = document.getElementById('micControl');
const status = document.getElementById('status');
const info = document.getElementById('info');
const compactIndicator = document.getElementById('compactIndicator');
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resumeBtn = document.getElementById("resumeBtn");
const micToggle = document.getElementById("micToggle");

// Function to request state and update UI
function syncUI() {
  chrome.runtime.sendMessage({ action: "GET_STATE" }, response => {
    if (chrome.runtime.lastError) {
      console.error("Error getting state:", chrome.runtime.lastError.message);
      // This can happen if the background script is not ready, retry once.
      setTimeout(syncUI, 300);
      return;
    }
    if (response && response.state) {
      updateUI(response.state);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  console.log("Popup loaded");

  // Load minimize state
  chrome.storage.local.get(['isMinimized'], (result) => {
    toggleMinimize(result.isMinimized || false);
  });

  // Get initial state to sync UI
  syncUI();
});

// Listen for state updates from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "STATE_UPDATED") {
        console.log("Received state update from background:", request.state);
        updateUI(request.state);
    }
});

// Event Listeners
minimizeBtn.addEventListener('click', () => toggleMinimize());
startBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', () => chrome.runtime.sendMessage({ action: "STOP_RECORDING" }));
pauseBtn.addEventListener('click', () => chrome.runtime.sendMessage({ action: "PAUSE_RECORDING" }));
resumeBtn.addEventListener('click', () => chrome.runtime.sendMessage({ action: "RESUME_RECORDING" }));

async function startRecording() {
  setLoadingState(true);
  showStatus("Initializing...", "info");

  const options = {
    withMic: micToggle.checked
  };

  chrome.runtime.sendMessage({ action: "START_RECORDING", options }, response => {
    if (chrome.runtime.lastError || (response && response.status === 'error')) {
      const errorMessage = response ? response.message : chrome.runtime.lastError.message;
      console.error("Failed to start recording:", errorMessage);
      showStatus(`Error: ${errorMessage}`, "error");
      setLoadingState(false);
      syncUI(); // Re-sync UI with actual state on failure
    }
  });
}

// UI Update Functions
function updateUI(state) {
  if (!state) return;

  const { isRecording, isPaused } = state;

  if (isRecording) {
    startBtn.style.display = 'none';
    mainButtonContainer.style.display = 'none';
    secondaryActions.style.display = 'flex';

    stopBtn.disabled = false;
    pauseBtn.disabled = isPaused;
    resumeBtn.disabled = !isPaused;

    if (isPaused) {
      showStatus("Recording is paused.", "paused");
      compactIndicator.classList.add("paused");
      compactIndicator.classList.remove("recording");
    } else {
      showStatus("Recording in progress...", "recording");
      compactIndicator.classList.add("recording");
      compactIndicator.classList.remove("paused");
    }
  } else {
    startBtn.style.display = 'inline-flex';
    mainButtonContainer.style.display = 'block';
    secondaryActions.style.display = 'none';
    
    stopBtn.disabled = true;
    pauseBtn.disabled = true;
    resumeBtn.disabled = true;
    setLoadingState(false);
    
    compactIndicator.classList.remove("recording", "paused");
    showStatus("Ready to record", "info");
  }
  
  micToggle.disabled = isRecording;

  toggleMinimize(isMinimized, true);
}


function toggleMinimize(forceState, isUiUpdate = false) {
  const previousState = isMinimized;
  isMinimized = typeof forceState === 'boolean' ? forceState : !isMinimized;
  
  if(!isUiUpdate && previousState !== isMinimized) {
      chrome.storage.local.set({ isMinimized: isMinimized });
  }

  body.classList.toggle('minimized', isMinimized);
  container.classList.toggle('minimized', isMinimized);
  title.classList.toggle('minimized', isMinimized);
  description.classList.toggle('minimized', isMinimized);
  mainButtonContainer.classList.toggle('minimized', isMinimized);
  secondaryActions.classList.toggle('minimized', isMinimized);
  micControl.classList.toggle('minimized', isMinimized);
  info.classList.toggle('minimized', isMinimized);
  status.classList.toggle('minimized', isMinimized);

  if (isMinimized) {
    minimizeIcon.innerHTML = '<i class="fas fa-chevron-down"></i>';
    minimizeBtn.title = "Expand";
    minimizeBtn.classList.add('minimized');
    if (document.querySelector('.compact-indicator.recording, .compact-indicator.paused')) {
        compactIndicator.style.display = 'block';
    }
  } else {
    minimizeIcon.innerHTML = '<i class="fas fa-chevron-up"></i>';
    minimizeBtn.title = "Minimize";
    minimizeBtn.classList.remove('minimized');
    compactIndicator.style.display = 'none';
  }
}

function setLoadingState(loading) {
  startBtn.disabled = loading;
  if (loading) {
    startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';
  } else {
    startBtn.innerHTML = '<i class="fas fa-play"></i> Start Recording';
  }
}

function showStatus(message, type = "info") {
  status.textContent = message;
  status.className = `status ${type}` + (isMinimized ? " minimized" : "");
}