document.addEventListener('DOMContentLoaded', () => {
    // DOM 元素
    const connectionStatusEl = document.getElementById('connection-status');
    const watchForm = document.getElementById('watch-form');
    const symbolInput = document.getElementById('symbol-input');
    const lowerPriceInput = document.getElementById('lower-price-input');
    const upperPriceInput = document.getElementById('upper-price-input');
    const watchListBody = document.getElementById('watch-list-body');
    const alertListBody = document.getElementById('alert-list-body');
    const alertSound = document.getElementById('alert-sound');
    const alertModal = new bootstrap.Modal(document.getElementById('alert-modal'));
    const alertModalBody = document.getElementById('alert-modal-body');
    const rawDataLog = document.getElementById('raw-data-log');
    const rawDataCard = document.getElementById('raw-data-card');
    const toggleRawDataSwitch = document.getElementById('toggle-raw-data-switch');

    // 控制原始数据可见性
    toggleRawDataSwitch.addEventListener('change', () => {
        if (toggleRawDataSwitch.checked) {
            rawDataCard.style.display = 'block';
        } else {
            rawDataCard.style.display = 'none';
        }
    });


    // 状态管理
    let watches = []; // 监控列表
    let currentPrices = {}; // 保存每个交易对的最新价格
    
    // WebSocket URL
    const wsURL = 'wss://fstream.binance.com/stream?streams=!markPrice@arr@1s';

    function connectWebSocket() {
        const socket = new WebSocket(wsURL);

        socket.onopen = () => {
            console.log('WebSocket 连接成功！');
            connectionStatusEl.textContent = '已连接';
            connectionStatusEl.classList.remove('bg-secondary', 'bg-danger');
            connectionStatusEl.classList.add('bg-success');
        };

        socket.onmessage = (event) => {
            // 在页面上显示原始数据
            rawDataLog.textContent = JSON.stringify(JSON.parse(event.data), null, 2);

            const message = JSON.parse(event.data);
            const priceUpdates = message.data;

            // 遍历收到的所有价格更新
            priceUpdates.forEach(update => {
                const symbol = update.s;
                const price = parseFloat(update.p);
                
                // 更新当前价格
                currentPrices[symbol] = price;

                // 检查是否在监控列表中
                const watch = watches.find(w => w.symbol === symbol);
                if (watch) {
                    // 更新监控列表中的实时价格
                    const priceCell = document.getElementById(`price-${symbol}`);
                    if (priceCell) {
                        priceCell.textContent = price.toFixed(4);
                        // 检查价格是否在范围内并更新样式
                        if (price < watch.lower || price > watch.upper) {
                            priceCell.classList.add('price-out-of-range');
                        } else {
                            priceCell.classList.remove('price-out-of-range');
                        }
                    }

                    // 检查是否触发警报
                    const isOutOfRange = price > watch.upper || price < watch.lower;
                    if (isOutOfRange && !watch.isTriggered) {
                        triggerAlert(watch, price);
                        watch.isTriggered = true; // 标记为已触发，防止重复报警
                    } else if (!isOutOfRange && watch.isTriggered) {
                        watch.isTriggered = false; // 价格回到范围内，重置触发状态
                    }
                }
            });
        };

        socket.onclose = () => {
            console.log('WebSocket 连接已断开，尝试重新连接...');
            connectionStatusEl.textContent = '已断开';
            connectionStatusEl.classList.remove('bg-success');
            connectionStatusEl.classList.add('bg-danger');
            // 简单重连机制
            setTimeout(connectWebSocket, 5000);
        };

        socket.onerror = (error) => {
            console.error('WebSocket 错误:', error);
            socket.close();
        };
    }

    // 触发警报
    function triggerAlert(watch, price) {
        console.log(`警报! ${watch.symbol} 价格 ${price} 超出范围 (${watch.lower} - ${watch.upper})`);
        
        // 1. 更新弹窗内容并显示
        alertModalBody.innerHTML = `<strong>${watch.symbol}</strong> 价格已达 <strong class="text-danger">${price.toFixed(4)}</strong>`;
        alertModal.show();
        
        // 2. 播放提示音
        alertSound.play().catch(e => console.error("音频播放失败:", e));
        
        // 3. 添加到警报记录
        const alertRow = document.createElement('tr');
        alertRow.classList.add('new-alert');
        alertRow.innerHTML = `
            <td>${new Date().toLocaleTimeString()}</td>
            <td>${watch.symbol}</td>
            <td>${price.toFixed(4)}</td>
        `;
        alertListBody.prepend(alertRow);
    }

    // 渲染监控列表
    function renderWatchList() {
        watchListBody.innerHTML = '';
        watches.forEach((watch, index) => {
            const price = currentPrices[watch.symbol] ? currentPrices[watch.symbol].toFixed(4) : '...';
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${watch.symbol}</td>
                <td id="price-${watch.symbol}">${price}</td>
                <td>${watch.lower}</td>
                <td>${watch.upper}</td>
                <td><button class="btn btn-sm btn-danger" data-index="${index}">删除</button></td>
            `;
            watchListBody.appendChild(row);
        });
    }

    // 处理表单提交
    watchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const symbol = symbolInput.value.toUpperCase().trim();
        const lower = parseFloat(lowerPriceInput.value);
        const upper = parseFloat(upperPriceInput.value);

        if (!symbol || isNaN(lower) || isNaN(upper) || lower >= upper) {
            alert('请输入有效的交易对和价格范围，且下限必须小于上限！');
            return;
        }

        // 检查是否已存在
        if (watches.some(w => w.symbol === symbol)) {
            alert(`${symbol} 已经在监控列表中！`);
            return;
        }

        watches.push({ symbol, lower, upper, isTriggered: false });
        renderWatchList();
        watchForm.reset();
    });

    // 处理删除按钮点击（事件委托）
    watchListBody.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.classList.contains('btn-danger')) {
            const index = parseInt(e.target.getAttribute('data-index'));
            watches.splice(index, 1);
            renderWatchList();
        }
    });

    // 启动 WebSocket 连接
    connectWebSocket();
});