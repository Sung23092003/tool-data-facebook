let searchTabId = null;
let currentConfig = null;
let allResults = [];
let filteredResults = [];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startScraping') {
        currentConfig = request;
        startScraping();
    }
});

async function sendMessageWithRetry(tabId, message, retries = 5) {
    for (let i = 0; i < retries; i++) {
        try {
            return await chrome.tabs.sendMessage(tabId, message);
        } catch (e) {
            console.log(`Retry ${i + 1}/${retries} to send message...`);
            // Ensure content script is injected if it might be missing
            if (i === 1) {
                await chrome.scripting.executeScript({
                    target: { tabId },
                    files: ['content.js']
                }).catch(err => console.error('Injection error:', err));
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    throw new Error('Could not establish connection to the page after multiple retries.');
}

async function startScraping() {
    allResults = [];
    filteredResults = [];
    
    // Step 1: Search Pages
    const url = `https://www.facebook.com/search/pages?q=${encodeURIComponent(currentConfig.serviceName)}`;
    
    // Find if we already have a FB search tab
    const tabs = await chrome.tabs.query({ url: "*://www.facebook.com/search/pages*" });
    let tab;
    if (tabs.length > 0) {
        tab = await chrome.tabs.update(tabs[0].id, { url, active: true });
    } else {
        tab = await chrome.tabs.create({ url });
    }
    searchTabId = tab.id;

    // Wait for page to load
    const loadListener = (tabId, info) => {
        if (tabId === searchTabId && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(loadListener);
            setTimeout(initScrapeSequence, 3000); // Give it some time to load initial results
        }
    };
    chrome.tabs.onUpdated.addListener(loadListener);
}

async function initScrapeSequence() {
    chrome.runtime.sendMessage({ action: 'statusUpdate', text: 'Đang cào danh sách trang từ kết quả tìm kiếm...' });
    
    try {
        const response = await sendMessageWithRetry(searchTabId, { action: 'scrollAndScrape' });
        
        if (response && response.results) {
            allResults = response.results;
            
            // Step 2: Filter results
            const keywords = currentConfig.keywords;
            const serviceName = currentConfig.serviceName.toLowerCase();
            
            filteredResults = allResults.filter(item => {
                const title = item.name.toLowerCase();
                // Check service name AND any of the keywords
                const hasService = title.includes(serviceName);
                const hasKeyword = keywords.length === 0 || keywords.some(k => title.includes(k));
                return hasService && hasKeyword;
            });

            chrome.runtime.sendMessage({ 
                action: 'progressUpdate', 
                total: allResults.length, 
                filtered: filteredResults.length 
            });

            if (filteredResults.length > 0) {
                chrome.runtime.sendMessage({ action: 'statusUpdate', text: `Đang lấy chi tiết cho ${filteredResults.length} trang đã lọc...` });
                await scrapeDetailsSequential();
            } else {
                chrome.runtime.sendMessage({ action: 'statusUpdate', text: 'Không tìm thấy trang nào phù hợp với bộ lọc.' });
                chrome.runtime.sendMessage({ action: 'scrapingComplete' });
            }
        }
    } catch (err) {
        console.error('Scraping error:', err);
        chrome.runtime.sendMessage({ action: 'statusUpdate', text: 'Lỗi khi cào danh sách: ' + err.message });
        chrome.runtime.sendMessage({ action: 'scrapingComplete' });
    }
}

async function scrapeDetailsSequential() {
    for (let i = 0; i < filteredResults.length; i++) {
        const item = filteredResults[i];
        chrome.runtime.sendMessage({ action: 'statusUpdate', text: `Đang quét (${i+1}/${filteredResults.length}): ${item.name}` });
        
        try {
            await chrome.tabs.update(searchTabId, { url: item.url });
            
            // Wait for detail page load
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve(); // Continue anyway on timeout
                }, 15000);

                const listener = (tabId, info) => {
                    if (tabId === searchTabId && info.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        clearTimeout(timeout);
                        setTimeout(resolve, 3500); // Wait for info to render
                    }
                };
                chrome.tabs.onUpdated.addListener(listener);
            });

            const details = await sendMessageWithRetry(searchTabId, { action: 'extractDetails' });
            
            const processedItem = {
                ...item,
                address: details?.address || '',
                phone: details?.phone || '',
                email: details?.email || ''
            };

            chrome.runtime.sendMessage({ 
                action: 'itemProcessed', 
                item: processedItem 
            });

        } catch (e) {
            console.error('Error details for', item.url, e);
            chrome.runtime.sendMessage({ 
                action: 'itemProcessed', 
                item: { ...item, address: 'Lỗi kết nối', phone: '', email: '' } 
            });
        }
    }

    chrome.runtime.sendMessage({ action: 'scrapingComplete' });
}
