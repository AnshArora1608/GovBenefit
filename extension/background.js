// GovBenefit Form Mentor - Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('GovBenefit Form Mentor extension installed successfully.');
  chrome.storage.local.set({
    apiBase: 'http://localhost:8000',
    activeScheme: 'pmegp',
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_CONFIG') {
    chrome.storage.local.get(['apiBase', 'activeScheme'], (result) => {
      sendResponse(result);
    });
    return true;
  }
});
