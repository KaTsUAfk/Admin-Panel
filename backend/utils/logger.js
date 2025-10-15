const winston = require('winston');
const path = require('path');
const Helpers = require('./helpers');

class Logger {
  constructor(logsPath) {
    this.logsPath = logsPath;
    
    // Создаем папку для логов если не существует
    const logsDir = path.dirname(this.logsPath);
    const fs = require('fs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Настройка winston для записи в файлы
    this.winstonLogger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        // Файл ошибок
        new winston.transports.File({ 
          filename: 'logs/error.log', 
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        }),
        // Основной файл логов
        new winston.transports.File({ 
          filename: 'logs/combined.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        }),
        // Файл для HTTP запросов
        new winston.transports.File({ 
          filename: 'logs/http.log',
          level: 'http',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ]
    });

    // В development режиме можно оставить вывод в консоль
    if (process.env.NODE_ENV !== 'production') {
      this.winstonLogger.add(new winston.transports.Console({
        format: winston.format.simple()
      }));
    }
  }

  logAction(req, action, details = {}) {
    const user = req.user;
    const ip = Helpers.getClientIp(req);
    const userAgent = req.get('User-Agent');

    const logEntry = {
      userId: user?.id,
      username: user?.username,
      role: user?.role,
      action,
      timestamp: new Date().toISOString(),
      ip,
      userAgent,
      ...details
    };

    // Сохраняем в Winston (в файл)
    this.winstonLogger.info('User action', logEntry);

    // Сохраняем в JSON файл (существующая функциональность)
    const logs = Helpers.loadJsonFile(this.logsPath, []);
    logs.push(logEntry);
    Helpers.saveJsonFile(this.logsPath, logs);
  }

  // Метод для логирования HTTP запросов
  logHttp(req, res, next) {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      
      // Не логируем частые запросы статуса
      if (req.path === '/api/status') return;
      
      this.winstonLogger.http('HTTP Request', {
        method: req.method,
        url: req.url,
        path: req.path,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: Helpers.getClientIp(req),
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
    });
    
    next();
  }

  error(message, meta = {}) {
    this.winstonLogger.error(message, meta);
  }

  warn(message, meta = {}) {
    this.winstonLogger.warn(message, meta);
  }

  info(message, meta = {}) {
    this.winstonLogger.info(message, meta);
  }

  http(message, meta = {}) {
    this.winstonLogger.http(message, meta);
  }

  getLogs(limit = null) {
    const logs = Helpers.loadJsonFile(this.logsPath, []);
    let result = logs.reverse();
    if (limit) {
      result = result.slice(0, limit);
    }
    return result;
  }
}

module.exports = Logger;