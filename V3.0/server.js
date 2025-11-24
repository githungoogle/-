const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 10000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // 提供静态文件服务

// ========== API 路由 ==========

// 获取所有监控项
app.get('/api/watches', (req, res) => {
    db.getAllWatches((err, watches) => {
        if (err) {
            res.status(500).json({ error: '获取监控列表失败', details: err.message });
        } else {
            res.json(watches);
        }
    });
});

// 添加监控项
app.post('/api/watches', (req, res) => {
    const { symbol, lower, upper } = req.body;
    
    if (!symbol || lower === undefined || upper === undefined) {
        return res.status(400).json({ error: '缺少必要参数' });
    }
    
    if (lower >= upper) {
        return res.status(400).json({ error: '下限必须小于上限' });
    }
    
    db.addWatch(symbol, lower, upper, (err, watch) => {
        if (err) {
            if (err.message.includes('UNIQUE')) {
                res.status(409).json({ error: '该交易对已在监控列表中' });
            } else {
                res.status(500).json({ error: '添加监控项失败', details: err.message });
            }
        } else {
            res.status(201).json(watch);
        }
    });
});

// 删除监控项
app.delete('/api/watches/:symbol', (req, res) => {
    const { symbol } = req.params;
    
    db.deleteWatch(symbol, (err, result) => {
        if (err) {
            res.status(500).json({ error: '删除监控项失败', details: err.message });
        } else {
            res.json({ message: '删除成功', ...result });
        }
    });
});

// 获取警报历史
app.get('/api/alerts', (req, res) => {
    db.getAlertHistory((err, alerts) => {
        if (err) {
            res.status(500).json({ error: '获取警报历史失败', details: err.message });
        } else {
            res.json(alerts);
        }
    });
});

// 添加警报记录
app.post('/api/alerts', (req, res) => {
    const { symbol, price, type } = req.body;
    
    if (!symbol || !price || !type) {
        return res.status(400).json({ error: '缺少必要参数' });
    }
    
    db.addAlert(symbol, price, type, (err, alert) => {
        if (err) {
            res.status(500).json({ error: '添加警报记录失败', details: err.message });
        } else {
            res.status(201).json(alert);
        }
    });
});

// 删除单条警报记录
app.delete('/api/alerts/:id', (req, res) => {
    const { id } = req.params;
    
    db.deleteAlert(parseInt(id), (err, result) => {
        if (err) {
            res.status(500).json({ error: '删除警报记录失败', details: err.message });
        } else {
            res.json({ message: '删除成功', ...result });
        }
    });
});

// 清空所有警报记录
app.delete('/api/alerts', (req, res) => {
    db.clearAllAlerts((err, result) => {
        if (err) {
            res.status(500).json({ error: '清空警报记录失败', details: err.message });
        } else {
            res.json({ message: '清空成功', ...result });
        }
    });
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: '服务运行正常' });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`
========================================
🚀 币安价格监控服务器启动成功！
📡 服务地址: http://192.168.50.194:${PORT}
📊 数据库: SQLite (binance_monitor.db)
========================================
    `);
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    db.db.close((err) => {
        if (err) {
            console.error('关闭数据库失败:', err.message);
        } else {
            console.log('数据库连接已关闭');
        }
        process.exit(0);
    });
});
