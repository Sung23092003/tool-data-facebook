chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scrollAndScrape') {
        processSearchPage(sendResponse);
        return true; 
    } else if (request.action === 'extractDetails') {
        const details = extractPageDetails();
        sendResponse(details);
    }
});

async function processSearchPage(sendResponse) {
    let results = [];
    const seenUrls = new Set();
    let noChangeCount = 0;
    const maxNoChange = 6;
    let lastCount = 0;

    const scrollInterval = setInterval(async () => {
        window.scrollTo(0, document.body.scrollHeight);
        
        // Use the structure provided by user:
        // span -> div -> span.xjp7ctv -> a
        const searchItems = document.querySelectorAll('span.xjp7ctv');
        
        searchItems.forEach(span => {
            const link = span.querySelector('a[role="presentation"], a[role="link"]');
            if (link) {
                const url = link.href.split('?')[0];
                const name = link.textContent.trim();
                
                if (!seenUrls.has(url) && url.includes('facebook.com') && !url.includes('/search/')) {
                    seenUrls.add(url);
                    results.push({ name, url });
                }
            }
        });

        // Backup selector if the above is too specific
        if (results.length === 0) {
            const backupLinks = document.querySelectorAll('a[href*="facebook.com/"][role="link"]');
            backupLinks.forEach(link => {
                const url = link.href.split('?')[0];
                const name = link.textContent.trim();
                if (name && !seenUrls.has(url) && !url.includes('/search/') && !url.includes('ref=') && url.length > 25) {
                    seenUrls.add(url);
                    results.push({ name, url });
                }
            });
        }

        if (results.length === lastCount) {
            noChangeCount++;
        } else {
            noChangeCount = 0;
            lastCount = results.length;
        }

        console.log(`Scraped: ${results.length} items. No change count: ${noChangeCount}`);

        // Check for "Đã hết kết quả" indicator
        let isEnd = false;
        
        // Method 1: Specific selector
        const endSpan = document.querySelector('span.xi81zsa.x2b8uid');
        if (endSpan && endSpan.innerText.includes('Đã hết kết quả')) {
            isEnd = true;
            console.log("End detected via selector.");
        } else {
            // Method 2: Comprehensive text search in all spans
            const spans = document.querySelectorAll('span');
            for (let i = spans.length - 1; i >= 0; i--) {
                if (spans[i].innerText.includes('Đã hết kết quả')) {
                    isEnd = true;
                    console.log("End detected via text search.");
                    break;
                }
            }
        }

        if (isEnd || noChangeCount >= maxNoChange) {
            console.log("Scraping finished. Moving to next step...");
            clearInterval(scrollInterval);
            sendResponse({ results });
        }
    }, 2500);
}

function extractPageDetails() {
    let address = '';
    let phone = '';
    let email = '';

    // Selector based on the SVG and classes provided for Address
    const addressElements = document.querySelectorAll('div.xtqikln.x78zum5.x1y1aw1k.xwib8y2');
    addressElements.forEach(div => {
        // Look for the Location Pin SVG (M12 5.499...)
        if (div.innerHTML.includes('M12 5.499')) {
            const link = div.querySelector('a[href*="maps/"]');
            if (link) {
                address = link.textContent.trim();
            } else {
                address = div.textContent.trim();
            }
        }
        
        // Look for Phone SVG (M3.12 1.465...)
        if (div.innerHTML.includes('M3.12 1.465')) {
             const phoneSpan = div.querySelector('span.x193iq5w.xeuugli.x13faqbe');
             if (phoneSpan) {
                 phone = phoneSpan.textContent.trim();
             } else {
                 phone = div.textContent.trim();
             }
        }

        // Look for Email SVG (M5.581 8.186... or just mailto link)
        if (div.innerHTML.includes('mailto:')) {
            const mailLink = div.querySelector('a[href^="mailto:"]');
            if (mailLink) email = mailLink.textContent.trim();
        }
    });

    // Fallback selectors
    if (!phone) {
        const text = document.body.innerText;
        const phoneRegex = /(0[0-9]{2,3}[代.\s-]?[0-9]{3,4}[代.\s-]?[0-9]{3,4})|(09[0-9]{8})|(\+84[0-9]{9})/g;
        const matches = text.match(phoneRegex);
        if (matches && matches.length > 0) phone = matches[0];
    }
    
    if (!email) {
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const matches = document.body.innerText.match(emailRegex);
        if (matches && matches.length > 0) email = matches[0];
    }

    return { address, phone, email };
}
