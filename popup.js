let scrapedData = [];
let filteredData = [];

const statusEl = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const exportBtn = document.getElementById('exportBtn');
const progressText = document.getElementById('progressText');
const filteredText = document.getElementById('filteredText');

startBtn.addEventListener('click', async () => {
    const serviceName = document.getElementById('serviceName').value.trim();
    const keywordsRaw = document.getElementById('keywords').value.trim();
    
    if (!serviceName) {
        alert('Vui lòng nhập tên dịch vụ');
        return;
    }

    const keywords = keywordsRaw.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
    
    scrapedData = [];
    filteredData = [];
    updateUI();
    
    startBtn.disabled = true;
    document.getElementById('app').classList.add('running');
    statusEl.innerText = 'Đang khởi tạo search...';

    chrome.runtime.sendMessage({
        action: 'startScraping',
        serviceName,
        keywords
    });
});

exportBtn.addEventListener('click', () => {
    if (filteredData.length === 0) return;

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filteredData);
    XLSX.utils.book_append_sheet(wb, ws, "Facebook Data");
    XLSX.writeFile(wb, `fb_data_${new Date().getTime()}.xlsx`);
});

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'statusUpdate') {
        statusEl.innerText = message.text;
    } else if (message.action === 'progressUpdate') {
        progressText.innerText = `Tổng: ${message.total} items`;
        filteredText.innerText = `Lọc: ${message.filtered} items`;
    } else if (message.action === 'scrapingComplete') {
        scrapedData = message.data;
        filteredData = message.filteredData;
        startBtn.disabled = false;
        exportBtn.disabled = filteredData.length === 0;
        document.getElementById('app').classList.remove('running');
        statusEl.innerText = `Hoàn thành! Đã lấy được ${filteredData.length} kết quả.`;
        updateUI();
    }
});

function updateUI() {
    progressText.innerText = `Tổng: ${scrapedData.length} items`;
    filteredText.innerText = `Lọc: ${filteredData.length} items`;
    exportBtn.disabled = filteredData.length === 0;
}
