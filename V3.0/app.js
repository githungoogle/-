
// API 配置
const API_BASE_URL = 'http://192.168.50.194:10000/api';

// ========== API 调用函数 ==========

// 获取所有监控项
async function fetchWatches() {
    try {
        const response = await fetch(`${API_BASE_URL}/watches`);
        if (!response.ok) throw new Error('获取监控列表失败');
        return await response.json();
    } catch (error) {
        console.error('获取监控列表失败:', error);
        showError('无法连接到服务器，请确保后端服务已启动');
        return [];
    }
}

// 添加监控项
async function addWatchToServer(symbol, lower, upper) {
    try {
        const response = await fetch(`${API_BASE_URL}/watches`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol, lower, upper })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '添加失败');
        }
        
        return await response.json();
    } catch (error) {
        console.error('添加监控项失败:', error);
        throw error;
    }
}

// 删除监控项
async function deleteWatchFromServer(symbol) {
    try {
        const response = await fetch(`${API_BASE_URL}/watches/${symbol}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('删除失败');
        return await response.json();
    } catch (error) {
        console.error('删除监控项失败:', error);
        throw error;
    }
}

// 获取警报历史
async function fetchAlerts() {
    try {
        const response = await fetch(`${API_BASE_URL}/alerts`);
        if (!response.ok) throw new Error('获取警报历史失败');
        return await response.json();
    } catch (error) {
        console.error('获取警报历史失败:', error);
        return [];
    }
}

// 添加警报记录
async function addAlertToServer(symbol, price, type) {
    try {
        const response = await fetch(`${API_BASE_URL}/alerts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol, price, type })
        });
        
        if (!response.ok) throw new Error('添加警报失败');
        return await response.json();
    } catch (error) {
        console.error('添加警报失败:', error);
        throw error;
    }
}

// 删除警报记录
async function deleteAlertFromServer(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/alerts/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('删除失败');
        return await response.json();
    } catch (error) {
        console.error('删除警报失败:', error);
        throw error;
    }
}

// 清空所有警报
async function clearAllAlertsFromServer() {
    try {
        const response = await fetch(`${API_BASE_URL}/alerts`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('清空失败');
        return await response.json();
    } catch (error) {
        console.error('清空警报失败:', error);
        throw error;
    }
}

// 显示错误提示
function showError(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);
    setTimeout(() => alertDiv.remove(), 5000);
}

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
    let watches = []; // 监控列表（从服务器加载）
    let alertHistory = []; // 警报历史（从服务器加载）
    let currentPrices = {}; // 保存每个交易对的最新价格
    
    // WebSocket URL
    const wsURL = 'wss://fstream.binance.com/stream?streams=!markPrice@arr@1s';
    let socket = null;
    let reconnectTimer = null;

    function connectWebSocket() {
        // 如果没有监控项，断开连接并返回
        if (watches.length === 0) {
            if (socket) {
                socket.close();
                socket = null;
            }
            connectionStatusEl.textContent = '未监控';
            connectionStatusEl.classList.remove('bg-success', 'bg-danger');
            connectionStatusEl.classList.add('bg-secondary');
            console.log('没有监控项，停止WebSocket连接');
            return;
        }

        if (socket && socket.readyState === WebSocket.OPEN) {
            return;
        }

        socket = new WebSocket(wsURL);

        socket.onopen = () => {
            console.log('WebSocket 连接成功！');
            connectionStatusEl.textContent = '已连接';
            connectionStatusEl.classList.remove('bg-secondary', 'bg-danger');
            connectionStatusEl.classList.add('bg-success');
        };

        socket.onmessage = (event) => {
            // 在页面上显示原始数据
            if (toggleRawDataSwitch.checked) {
                rawDataLog.textContent = JSON.stringify(JSON.parse(event.data), null, 2);
            }

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
                        priceCell.textContent = price.toFixed(6);
                        // 检查价格是否在范围内并更新样式
                        if (price < watch.lower || price > watch.upper) {
                            priceCell.classList.add('price-out-of-range');
                        } else {
                            priceCell.classList.remove('price-out-of-range');
                        }
                    }

                    // 检查是否触发警报
                    const isOutOfRange = price > watch.upper || price < watch.lower;
                    if (isOutOfRange) {
                        // 触发警报并从监控列表中移除
                        const alertType = price < watch.lower ? '低于下限' : '高于上限';
                        triggerAlert(watch, price, alertType);
                        
                        // 从服务器删除该交易对
                        deleteWatchFromServer(symbol).then(() => {
                            // 重新加载监控列表
                            loadWatchList();
                        });
                    }
                }
            });
        };

        socket.onclose = () => {
            console.log('WebSocket 连接已断开');
            connectionStatusEl.textContent = '已断开';
            connectionStatusEl.classList.remove('bg-success');
            connectionStatusEl.classList.add('bg-danger');
            
            // 清除之前的重连定时器
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
            }
            
            // 只在有监控项时重连
            if (watches.length > 0) {
                console.log('5秒后尝试重新连接...');
                reconnectTimer = setTimeout(connectWebSocket, 5000);
            } else {
                connectionStatusEl.textContent = '未监控';
                connectionStatusEl.classList.remove('bg-danger');
                connectionStatusEl.classList.add('bg-secondary');
            }
        };

        socket.onerror = (error) => {
            console.error('WebSocket 错误:', error);
            socket.close();
        };
    }

    // 触发警报
    async function triggerAlert(watch, price, alertType) {
        console.log(`警报! ${watch.symbol} 价格 ${price} 超出范围 (${watch.lower} - ${watch.upper})`);
        
        // 1. 更新弹窗内容并显示
        alertModalBody.innerHTML = `
            <strong>${watch.symbol}</strong><br>
            当前价格: <span class="text-danger">${price.toFixed(6)}</span><br>
            ${alertType}
        `;
        alertModal.show();
        
        // 2. 播放提示音
        alertSound.play().catch(e => console.error("音频播放失败:", e));
        
        // 3. 添加到服务器警报历史
        try {
            await addAlertToServer(watch.symbol, price, alertType);
            // 重新加载警报历史
            await loadAlertHistory();
        } catch (error) {
            console.error('保存警报失败:', error);
        }
    }

    // 渲染监控列表
    function renderWatchList() {
        if (watches.length === 0) {
            watchListBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">暂无监控项，请添加交易对</td></tr>';
            return;
        }
        
        watchListBody.innerHTML = '';
        watches.forEach((watch, index) => {
            const price = currentPrices[watch.symbol] ? currentPrices[watch.symbol].toFixed(6) : '等待数据...';
            const isOutOfRange = currentPrices[watch.symbol] && 
                (currentPrices[watch.symbol] < watch.lower || currentPrices[watch.symbol] > watch.upper);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${watch.symbol}</strong></td>
                <td id="price-${watch.symbol}" class="${isOutOfRange ? 'price-out-of-range' : ''}">${price}</td>
                <td>${watch.lower}</td>
                <td>${watch.upper}</td>
                <td><button class="btn btn-sm btn-danger" data-index="${index}">删除</button></td>
            `;
            watchListBody.appendChild(row);
        });
    }

    // 渲染警报历史
    function renderAlertHistory() {
        if (alertHistory.length === 0) {
            alertListBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">暂无警报记录</td></tr>';
            return;
        }
        
        alertListBody.innerHTML = '';
        // 显示所有警报（服务器已限制50条）
        alertHistory.forEach((alert) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${alert.time}</td>
                <td><strong>${alert.symbol}</strong> (${alert.type})</td>
                <td class="text-danger fw-bold">${alert.price.toFixed(6)}</td>
                <td><button class="btn btn-sm btn-outline-danger delete-alert" data-id="${alert.id}">删除</button></td>
            `;
            alertListBody.appendChild(row);
        });
    }
    
    // 加载监控列表
    async function loadWatchList() {
        watches = await fetchWatches();
        renderWatchList();
        
        // 如果有监控项但 WebSocket 未连接，则连接
        if (watches.length > 0 && (!socket || socket.readyState !== WebSocket.OPEN)) {
            connectWebSocket();
        } else if (watches.length === 0 && socket) {
            socket.close();
            socket = null;
            connectionStatusEl.textContent = '未监控';
            connectionStatusEl.classList.remove('bg-success', 'bg-danger');
            connectionStatusEl.classList.add('bg-secondary');
        }
    }
    
    // 加载警报历史
    async function loadAlertHistory() {
        alertHistory = await fetchAlerts();
        renderAlertHistory();
    }

    // 处理表单提交
    watchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const symbol = symbolInput.value.toUpperCase().trim();
        const lower = parseFloat(lowerPriceInput.value);
        const upper = parseFloat(upperPriceInput.value);

        if (!symbol || isNaN(lower) || isNaN(upper) || lower >= upper) {
            alert('请输入有效的交易对和价格范围，且下限必须小于上限！');
            return;
        }

        try {
            await addWatchToServer(symbol, lower, upper);
            await loadWatchList();
            watchForm.reset();
        } catch (error) {
            alert(error.message || '添加失败');
        }
    });

    // 处理监控列表删除按钮点击（事件委托）
    watchListBody.addEventListener('click', async (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.classList.contains('btn-danger')) {
            const index = parseInt(e.target.getAttribute('data-index'));
            const symbol = watches[index].symbol;
            
            if (confirm(`确定要删除 ${symbol} 的监控吗？`)) {
                try {
                    await deleteWatchFromServer(symbol);
                    await loadWatchList();
                } catch (error) {
                    alert('删除失败');
                }
            }
        }
    });

    // 处理警报列表删除按钮点击（事件委托）
    alertListBody.addEventListener('click', async (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.classList.contains('delete-alert')) {
            const id = parseInt(e.target.getAttribute('data-id'));
            
            try {
                await deleteAlertFromServer(id);
                await loadAlertHistory();
            } catch (error) {
                alert('删除失败');
            }
        }
    });

    // 清空全部警报记录
    document.getElementById('clear-all-alerts').addEventListener('click', async () => {
        if (alertHistory.length === 0) {
            return;
        }
        
        if (confirm('确定要清空所有警报记录吗？')) {
            try {
                await clearAllAlertsFromServer();
                await loadAlertHistory();
            } catch (error) {
                alert('清空失败');
            }
        }
    });

    // 页面加载时初始化
    (async function init() {
        await loadWatchList();
        await loadAlertHistory();
    })();
    
    // 页面关闭前清理
    window.addEventListener('beforeunload', () => {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
        }
        if (socket) {
            socket.close();
        }
    });
});