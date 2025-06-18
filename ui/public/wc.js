// Extract the path parameter from the URL
const urlParams = new URLSearchParams(window.location.search);
const path = urlParams.get('path');

if (path) {
  // Extract the URI from the path
  const uriMatch = path.match(/\/wc\?uri=(.+)/);
  if (uriMatch && uriMatch[1]) {
    const uri = decodeURIComponent(uriMatch[1]);
    // Send message to background script to pair the URI
    chrome.runtime.sendMessage({
      type: 'PAIR_WALLET_CONNECT_URI',
      uri: uri
    });
  }
} 