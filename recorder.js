// recorder.js - background service worker (Manifest V3)

// Logs when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log("🎬 Screen Recorder Extension installed.");
});

// Optional: Listen for messages (from popup.js, content scripts, etc.)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "PING") {
    console.log("Received PING from popup");
    sendResponse({ status: "PONG from background" });
  }

  // You can handle start/stop recording here too if logic moves to background
  return true;
});
