document.getElementById('openScanner').addEventListener('click', () => {
    chrome.tabs.create({ url: 'scanner.html' });
});
