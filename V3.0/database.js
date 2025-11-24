const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库文件路径
const DB_PATH = path.join(__dirname, 'binance_monitor.db');

// 创建数据库连接
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('数据库连接失败:', err.message);
    } else {
        console.log('数据库连接成功:', DB_PATH);
        initDatabase();
    }
});

// 初始化数据库表
function initDatabase() {
    // 创建监控列表表
    db.run(`
        CREATE TABLE IF NOT EXISTS watch_list (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL UNIQUE,
            lower_price REAL NOT NULL,
            upper_price REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('创建 watch_list 表失败:', err.message);
        } else {
            console.log('watch_list 表已就绪');
        }
    });

    // 创建警报历史表
    db.run(`
        CREATE TABLE IF NOT EXISTS alert_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            price REAL NOT NULL,
            alert_type TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('创建 alert_history 表失败:', err.message);
        } else {
            console.log('alert_history 表已就绪');
        }
    });
}

// ========== 监控列表操作 ==========

// 获取所有监控项
function getAllWatches(callback) {
    db.all('SELECT * FROM watch_list ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            callback(err, null);
        } else {
            const watches = rows.map(row => ({
                symbol: row.symbol,
                lower: row.lower_price,
                upper: row.upper_price
            }));
            callback(null, watches);
        }
    });
}

// 添加监控项
function addWatch(symbol, lowerPrice, upperPrice, callback) {
    db.run(
        'INSERT INTO watch_list (symbol, lower_price, upper_price) VALUES (?, ?, ?)',
        [symbol, lowerPrice, upperPrice],
        function(err) {
            if (err) {
                callback(err);
            } else {
                callback(null, { symbol, lower: lowerPrice, upper: upperPrice });
            }
        }
    );
}

// 删除监控项
function deleteWatch(symbol, callback) {
    db.run('DELETE FROM watch_list WHERE symbol = ?', [symbol], function(err) {
        if (err) {
            callback(err);
        } else {
            callback(null, { deleted: this.changes });
        }
    });
}

// ========== 警报历史操作 ==========

// 获取警报历史（最近50条）
function getAlertHistory(callback) {
    db.all(
        'SELECT * FROM alert_history ORDER BY created_at DESC LIMIT 50',
        [],
        (err, rows) => {
            if (err) {
                callback(err, null);
            } else {
                const alerts = rows.map(row => ({
                    id: row.id,
                    time: new Date(row.created_at).toLocaleString('zh-CN'),
                    symbol: row.symbol,
                    price: row.price,
                    type: row.alert_type
                }));
                callback(null, alerts);
            }
        }
    );
}

// 添加警报记录
function addAlert(symbol, price, alertType, callback) {
    db.run(
        'INSERT INTO alert_history (symbol, price, alert_type) VALUES (?, ?, ?)',
        [symbol, price, alertType],
        function(err) {
            if (err) {
                callback(err);
            } else {
                callback(null, { 
                    id: this.lastID,
                    symbol, 
                    price, 
                    type: alertType,
                    time: new Date().toLocaleString('zh-CN')
                });
            }
        }
    );
}

// 删除单条警报记录
function deleteAlert(id, callback) {
    db.run('DELETE FROM alert_history WHERE id = ?', [id], function(err) {
        if (err) {
            callback(err);
        } else {
            callback(null, { deleted: this.changes });
        }
    });
}

// 清空所有警报记录
function clearAllAlerts(callback) {
    db.run('DELETE FROM alert_history', [], function(err) {
        if (err) {
            callback(err);
        } else {
            callback(null, { deleted: this.changes });
        }
    });
}

// 导出所有函数
module.exports = {
    db,
    getAllWatches,
    addWatch,
    deleteWatch,
    getAlertHistory,
    addAlert,
    deleteAlert,
    clearAllAlerts
};
