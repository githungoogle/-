// ========================================
// 配置文件 - 可根据需要修改
// ========================================

module.exports = {
    // 服务器配置
    server: {
        port: process.env.PORT || 10000,
        host: '0.0.0.0', // 允许所有 IP 访问
    },

    // 数据库配置
    database: {
        filename: 'binance_monitor.db',
        maxAlertHistory: 500, // 最多保存的警报记录数
    },

    // WebSocket 配置
    websocket: {
        url: 'wss://fstream.binance.com/stream?streams=!markPrice@arr@1s',
        reconnectInterval: 5000, // 重连间隔（毫秒）
    },

    // CORS 配置
    cors: {
        origin: '*', // 允许所有来源，生产环境建议限制
        credentials: true,
    },

    // 日志配置
    logging: {
        enabled: true,
        level: 'info', // 'debug', 'info', 'warn', 'error'
    },
};
