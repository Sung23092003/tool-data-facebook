let filteredData = [];

const startBtn = document.getElementById('startBtn');
const exportBtn = document.getElementById('exportBtn');
const statusText = document.getElementById('statusText');
const totalItemsEl = document.getElementById('totalItems');
const filteredItemsEl = document.getElementById('filteredItems');
const resultsTableBody = document.getElementById('resultsTableBody');
const loader = document.getElementById('mainLoader');

startBtn.addEventListener('click', async () => {
    const serviceName = document.getElementById('serviceName').value.trim();
    const keywordsRaw = document.getElementById('keywords').value.trim();

    if (!serviceName) {
        alert('Vui lòng nhập tên dịch vụ');
        return;
    }

    const keywords = keywordsRaw.split(',').map(k => k.trim().toLowerCase()).filter(k => k);

    // Reset UI
    filteredData = [];
    resultsTableBody.innerHTML = '';
    totalItemsEl.innerText = '0';
    filteredItemsEl.innerText = '0';

    startBtn.disabled = true;
    exportBtn.disabled = true;
    loader.style.display = 'inline-block';
    statusText.innerText = 'Đang khởi tạo tìm kiếm trên Facebook...';

    chrome.runtime.sendMessage({
        action: 'startScraping',
        serviceName,
        keywords
    });
});

exportBtn.addEventListener('click', () => {
    if (filteredData.length === 0) return;

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filteredData.map(item => ({
        'Tên Page': item.name,
        'Địa chỉ': item.address,
        'Số điện thoại': item.phone,
        'Email': item.email,
        'Link': item.url
    })));
    XLSX.utils.book_append_sheet(wb, ws, "Facebook Data");
    XLSX.writeFile(wb, `fb_data_${new Date().getTime()}.xlsx`);
});

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'statusUpdate') {
        statusText.innerText = message.text;
    } else if (message.action === 'progressUpdate') {
        totalItemsEl.innerText = message.total;
        filteredItemsEl.innerText = message.filtered;
    } else if (message.action === 'itemProcessed') {
        // Add to table in real-time
        const item = message.item;
        filteredData.push(item);
        filteredItemsEl.innerText = filteredData.length;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.address || '---'}</td>
            <td>${item.phone || '---'}</td>
            <td class="link-cell"><a href="${item.url}" target="_blank">Xem trang</a></td>
        `;
        resultsTableBody.appendChild(row);
    } else if (message.action === 'scrapingComplete') {
        startBtn.disabled = false;
        exportBtn.disabled = filteredData.length === 0;
        loader.style.display = 'none';
        statusText.innerText = `Hoàn thành! Tìm thấy ${filteredData.length} kết quả phù hợp.`;
    }
});
