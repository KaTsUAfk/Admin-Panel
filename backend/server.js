"use strict"; 
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const Helpers = require('./utils/helpers');
const Logger = require('./utils/logger');
const AuthService = require('./services/authService');
const DeviceManager = require('./services/deviceManager');
const VideoService = require('./services/videoService');
const ScriptService = require('./services/scriptService');
const UserService = require('./services/userService');
const rateLimit = require('express-rate-limit');
const { validateLogin } = require('./middleware/validation');
const validateCity = require('./middleware/validateCity');


const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 10, // максимум 5 попыток
  message: { 
    success: false, 
    error: 'Слишком много попыток. Попробуйте позже.' 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 минута
  max: 200, // максимум 100 запросов в минуту
  message: { 
    success: false, 
    error: 'Слишком много запросов' 
  }
});

class SyncServer {
  constructor() {
    this.app = express();
    this.backendDir = path.join(__dirname);
    this.setupServices();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupServices() {
    // Инициализация сервисов
    this.authService = new AuthService(
      path.join(this.backendDir, 'users.json'),
      path.join(this.backendDir, 'active-tokens.json')
    );

    this.actionLogger = new Logger(path.join(this.backendDir, 'action-logs.json'));
    this.loginLogger = new Logger(path.join(this.backendDir, 'login-logs.json'));

    this.deviceManager = new DeviceManager();
    this.videoService = new VideoService(config.CITY_CONFIG);
    this.scriptService = new ScriptService(config.CITY_CONFIG);

    this.userService = new UserService(path.join(this.backendDir, 'users.json'));

    // Загрузка начальных данных
    this.loadInitialData();
  }

  loadInitialData() {
    // Очистка устаревших токенов при запуске
    this.authService.cleanupExpiredTokens();
    console.log('🚀 Сервер инициализирован');
  }


  
setupMiddleware() {
    // 🔧 ДОВЕРИЕ ПРОКСИ ДЛЯ RATE LIMIT
    this.app.set('trust proxy', 1);
    
    // Базовые middleware
    this.app.use(express.json());
    this.app.use(cors({
      origin: config.CORS_ORIGINS,
      methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-City'],
      credentials: true
    }));

    // Rate limiting ПОСЛЕ express.json()
    this.app.use('/api/login', authLimiter);
    this.app.use('/api/register', authLimiter);
    this.app.use('/api/', apiLimiter);

    // Логирование запросов
    this.app.use(this.actionLogger.logHttp.bind(this.actionLogger));

    // Middleware для проверки аутентификации
    this.app.use('/api', this.handleAuth.bind(this));
  }

  handleAuth(req, res, next) {
    const PUBLIC_ROUTES = new Set(['/login', '/register', '/sync', '/confirm', '/health']);
    const routePath = req.path.replace('/api', '');
    
    if (PUBLIC_ROUTES.has(routePath)) {
      return next();
    }
    
    this.authService.authenticateToken(req, res, next);
  }

  setupRoutes() {
    // Аутентификация с валидацией
    this.app.post('/api/login', validateLogin, this.handleLogin.bind(this));
    this.app.post('/api/upload-video', validateCity, this.handleUploadVideo.bind(this));
    
    // Аутентификация
    this.app.post('/api/logout', this.handleLogout.bind(this));
    this.app.post('/api/register', this.handleRegister.bind(this));

    // Устройства и синхронизация
    this.app.get('/api/sync', this.handleSync.bind(this));
    this.app.post('/api/confirm', this.handleConfirm.bind(this));
    this.app.post('/api/restart', this.handleRestart.bind(this));
    this.app.get('/api/status', this.handleStatus.bind(this));

    // Видео файлы
    this.app.get('/api/video-files', this.handleGetVideoFiles.bind(this));
    this.app.delete('/api/video-files/:filename', this.handleDeleteVideo.bind(this));

    // Обработка видео
    this.app.post('/api/process-video', this.handleProcessVideo.bind(this));
    this.app.get('/api/script-status', this.handleScriptStatus.bind(this));

    // Команды устройствам
    this.app.post('/api/device/:deviceId/command', this.handleDeviceCommand.bind(this));

    // Логи
    this.app.get('/api/active-sessions', this.handleActiveSessions.bind(this));
    this.app.get('/api/download-logs', this.handleDownloadLoginLogs.bind(this));
    this.app.get('/api/action-logs', this.handleActionLogs.bind(this));
    this.app.get('/api/download-action-logs', this.handleDownloadActionLogs.bind(this));

    //Темы
    this.app.get('/api/user/settings', this.handleGetUserSettings.bind(this));
    this.app.put('/api/user/settings', this.handleUpdateUserSettings.bind(this));

    // Health check
    this.app.get('/api/health', this.handleHealth.bind(this));

    // Обработка ошибок
    this.app.use(this.handleErrors.bind(this));
  }

  // ===== ОБРАБОТЧИКИ РОУТОВ =====

  async handleLogin(req, res) {
    try {
      const { username, password } = req.body;
      const userAgent = req.get('User-Agent');
      const ip = req.body.clientIp || Helpers.getClientIp(req);
      // 🔧 ДОБАВЬТЕ ПРОВЕРКУ ДЛЯ ОТЛАДКИ
      console.log('Login request body:', req.body);
      // 🔧 ДОБАВЬТЕ FALLBACK ДЛЯ req.body
      if (!username || !password) {
        return res.status(400).json({ 
          success: false, 
          error: 'Логин и пароль обязательны' 
        });
      }

      const result = await this.authService.login(username, password, ip, userAgent);
      
      if (result.success) {
        this.loginLogger.logAction(req, 'login', { 
          userId: result.user.id, 
          username: result.user.username 
        });
        
        res.json(result);
      } else {
        this.loginLogger.warn('Failed login attempt', { username, ip });
        res.status(401).json(result);
      }
    } catch (error) {
      this.actionLogger.error('Login error', { error: error.message });
      res.status(500).json({ 
        success: false, 
        error: 'Внутренняя ошибка сервера' 
      });
    }
  }

  async handleGetUserSettings(req, res) {
  try {
    const settings = this.userService.getUserSettings(req.user.id);
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Get user settings error:', error);
    res.status(500).json({ success: false, error: 'Ошибка получения настроек' });
    }
  }

  async handleUpdateUserSettings(req, res) {
    try {
      const { settings } = req.body;
      const updatedUser = this.userService.updateUserSettings(req.user.id, settings);
      
      res.json({ 
        success: true, 
        message: 'Настройки обновлены',
        settings: updatedUser.settings 
      });
    } catch (error) {
      console.error('Update user settings error:', error);
      res.status(500).json({ success: false, error: 'Ошибка обновления настроек' });
    }
  }

  handleLogout(req, res) {
    try {
      this.authService.logout(req);
      res.json({ success: true, message: 'Выход выполнен' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Ошибка при выходе' 
      });
    }
  }

  async handleRegister(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ 
          success: false, 
          error: 'Логин и пароль обязательны' 
        });
      }

      const result = await this.authService.register(username, password);
      
      if (result.success) {
        this.loginLogger.logAction(req, 'register', { 
          userId: result.user.id, 
          username: result.user.username 
        });
        
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Внутренняя ошибка сервера' 
      });
    }
  }

  handleSync(req, res) {
    try {
      const deviceId = String(req.query.deviceId || "").trim();
      const position = Helpers.toInt(req.query.position, 0);
      
      if (!deviceId || deviceId.length > 128) {
        return res.status(400).json({ error: "Invalid deviceId" });
      }

      const syncData = this.deviceManager.handleDeviceSync(deviceId, position);
      res.json(syncData);
    } catch (error) {
      console.error('Sync error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  handleConfirm(req, res) {
    try {
      const deviceId = String(req.body?.deviceId || "").trim();
      const confirmData = this.deviceManager.handleDeviceConfirm(deviceId);
      res.json(confirmData);
    } catch (error) {
      console.error('Confirm error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  handleRestart(req, res) {
    try {
      const restartData = this.deviceManager.scheduleCountdown();
      this.actionLogger.logAction(req, 'restart_devices');
      res.json(restartData);
    } catch (error) {
      console.error('Restart error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  handleStatus(req, res) {
    try {
      const status = this.deviceManager.getStatus();
      res.json(status);
    } catch (error) {
      console.error('Status error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async handleUploadVideo(req, res) {
    try {
      const city = req.headers['x-city'] || 'kurgan';
      
      if (!config.CITY_CONFIG[city]) {
        return res.status(400).json({ 
          success: false, 
          message: `Город ${city} не поддерживается` 
        });
      }

      const result = await this.videoService.uploadVideo(req, res, city);
      
      if (result.success) {
        this.actionLogger.logAction(req, 'upload_video', result.details);
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Upload video error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка загрузки файла: ' + error.message 
      });
    }
  }

  async handleGetVideoFiles(req, res) {
    try {
      const city = req.query.city || 'kurgan';
      
      if (!config.CITY_CONFIG[city]) {
        return res.status(400).json({ 
          success: false, 
          message: `Город ${city} не поддерживается` 
        });
      }

      const result = await this.videoService.getVideoFiles(city);
      res.json(result);
    } catch (error) {
      console.error('Get video files error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка получения списка файлов' 
      });
    }
  }

  async handleDeleteVideo(req, res) {
    try {
      const filename = req.params.filename;
      const city = req.query.city || 'kurgan';

      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ 
          success: false, 
          message: 'Некорректное имя файла' 
        });
      }

      const result = await this.videoService.deleteVideoFile(filename, city);
      
      if (result.success) {
        this.actionLogger.logAction(req, 'delete_video', { filename, city });
        res.json(result);
      } else {
        res.status(404).json(result);
      }
    } catch (error) {
      console.error('Delete video error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка удаления файла' 
      });
    }
  }

  async handleProcessVideo(req, res) {
    try {
      const city = req.body.city || req.query.city || 'kurgan';
      
      if (!config.CITY_CONFIG[city]) {
        return res.status(400).json({ 
          success: false, 
          message: `Город ${city} не поддерживается` 
        });
      }

      console.log(`=== ЗАПРОС НА ОБРАБОТКУ ВИДЕО ДЛЯ ${city} ===`);

      // Немедленно отвечаем клиенту
      res.json({ 
        success: true, 
        message: `Скрипт обработки видео запущен для города ${city}. Это может занять несколько минут.` 
      });

      // Запускаем скрипт асинхронно после ответа
      this.actionLogger.logAction(req, 'run_concat_script', { city });
      
      this.scriptService.executeVideoScript(city)
        .then(() => {
          console.log(`✅ СКРИПТ ВЫПОЛНЕН УСПЕШНО ДЛЯ ${city}`);
        })
        .catch(error => {
          console.error(`❌ ОШИБКА ВЫПОЛНЕНИЯ СКРИПТА ДЛЯ ${city}:`, error);
        });

    } catch (error) {
      console.error('Process video error:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }

  handleScriptStatus(req, res) {
    try {
      const status = this.scriptService.getStatus();
      res.json(status);
    } catch (error) {
      console.error('Script status error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка получения статуса скрипта' 
      });
    }
  }

  handleDeviceCommand(req, res) {
    try {
      const deviceId = req.params.deviceId;
      const command = req.body.command;

      if (!this.deviceManager.hasDevice(deviceId)) {
        return res.status(404).json({ error: "Device not found" });
      }

      this.deviceManager.sendCommandToDevice(deviceId, command);
      this.actionLogger.logAction(req, 'send_command', { deviceId, command });

      console.log(`[ADMIN] Command "${command}" sent to device ${deviceId}`);
      res.json({ 
        status: "command_sent", 
        deviceId, 
        command, 
        timestamp: Date.now() 
      });
    } catch (error) {
      console.error('Device command error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  handleActiveSessions(req, res) {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Доступ запрещён' });
      }

      const limit = parseInt(req.query.limit) || null;
      const sessions = this.loginLogger.getLogs(limit);
      res.json({ sessions });
    } catch (error) {
      console.error('Active sessions error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  handleDownloadLoginLogs(req, res) {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Доступ запрещён' });
      }

      const logs = this.loginLogger.getLogs();
      res.setHeader('Content-Disposition', 'attachment; filename="login-logs.json"');
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(logs, null, 2));
    } catch (error) {
      console.error('Download login logs error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  handleActionLogs(req, res) {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Доступ запрещён' });
      }

      const limit = parseInt(req.query.limit) || 50;
      const logs = this.actionLogger.getLogs(limit);
      res.json({ logs });
    } catch (error) {
      console.error('Action logs error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  handleDownloadActionLogs(req, res) {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Доступ запрещён' });
      }

      const logs = this.actionLogger.getLogs();
      res.setHeader('Content-Disposition', 'attachment; filename="action-logs.json"');
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(logs, null, 2));
    } catch (error) {
      console.error('Download action logs error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  handleHealth(req, res) {
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      cities: Object.keys(config.CITY_CONFIG),
      activeDevices: this.deviceManager.getDeviceCount(),
      scriptRunning: this.scriptService.isRunning()
    });
  }

  handleErrors(error, req, res, next) {
    this.actionLogger.error('Unhandled error', { 
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method
    });
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        success: false, 
        message: 'Файл слишком большой. Максимальный размер: 500MB' 
      });
    }

    res.status(500).json({ 
      success: false, 
      message: 'Внутренняя ошибка сервера' 
    });
  }

  start() {
    this.app.listen(config.PORT, '0.0.0.0', () => {
      console.log(`✅ Sync server running on http://0.0.0.0:${config.PORT}`);
      console.log(`✅ Health check: http://localhost:${config.PORT}/api/health`);
      console.log(`✅ Поддерживаемые города: ${Object.keys(config.CITY_CONFIG).join(', ')}`);
      console.log(`✅ CORS разрешены для: ${config.CORS_ORIGINS.join(', ')}`);
    });

    return this.app;
  }
}

// Запуск сервера
if (require.main === module) {
  const server = new SyncServer();
  server.start();
}

module.exports = SyncServer;