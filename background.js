// background.js - Manages the offscreen document and download trigger.

// Listen for messages from the popup or other extension parts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Asynchronously handle the request
  (async () => {
    if (request.action === "GET_STATE") {
      const state = await chrome.storage.local.get(null);
      sendResponse({ status: "success", state });
      return;
    }

    if (request.action === "DOWNLOAD_FILE") {
      // The offscreen doc has prepared the URL, just download it.
      chrome.downloads.download({
        url: request.url,
        filename: request.filename,
        saveAs: true,
      }, async () => {
        if (chrome.runtime.lastError) {
          console.error("Download failed:", chrome.runtime.lastError.message);
        }
        // Clean up after the download command is issued
        await closeOffscreenDocument();
      });
      sendResponse({ status: "success" });
      return;
    }
    
    // All other recording commands are forwarded to the offscreen document
    if (["START_RECORDING", "STOP_RECORDING", "PAUSE_RECORDING", "RESUME_RECORDING"].includes(request.action)) {
      await setupOffscreenDocument('offscreen.html');
      chrome.runtime.sendMessage({ ...request, action: `OFFSCREEN_${request.action}` });
      sendResponse({ status: "success" });
      return;
    }
  })();
  
  return true; // Indicates an asynchronous response.
});

// Offscreen Document Management
let creating; // A promise to prevent race conditions

async function setupOffscreenDocument(path) {
  const offscreenUrl = chrome.runtime.getURL(path);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  }).catch(() => {});

  if (existingContexts && existingContexts.length > 0) {
    return;
  }

  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: offscreenUrl,
      reasons: ['USER_MEDIA'],
      justification: 'To capture tab and screen media streams.',
    });
    await creating;
    creating = null;
  }
}

async function closeOffscreenDocument() {
  await chrome.offscreen.closeDocument().catch(() => {});
}