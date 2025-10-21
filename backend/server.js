"use strict";
require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const config = require("./config");
const Helpers = require("./utils/helpers");
const AuthService = require("./services/authService");
const DeviceManager = require("./services/deviceManager");
const VideoService = require("./services/videoService");
const ScriptService = require("./services/scriptService");
const UserService = require("./services/userService");
const rateLimit = require("express-rate-limit");
const { validateLogin } = require("./middleware/validation");
const validateCity = require("./middleware/validateCity");
const morgan = require("morgan");
const jwt = require("jsonwebtoken"); // Добавьте эту строку

// 🔑 Prisma для логирования
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// 🌐 Получение IP с учётом прокси
function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.socket.remoteAddress ||
    req.connection.remoteAddress ||
    "unknown"
  );
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5,
  message: {
    success: false,
    error: "Слишком много попыток входа. Попробуйте через 15 минут.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  message: {
    success: false,
    error: "Слишком много запросов",
  },
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
    this.authService = new AuthService();
    this.userService = new UserService();
    this.deviceManager = new DeviceManager();
    this.videoService = new VideoService(config.CITY_CONFIG);
    this.scriptService = new ScriptService(config.CITY_CONFIG);
    this.loadInitialData();
  }

  handleSync(req, res) {
    try {
      const deviceId = String(req.query.deviceId || "").trim();
      const position = Helpers.toInt(req.query.position, 0);
      const city = req.query.city || req.body?.city || 'unknown';
      console.log(`[SYNC] Device ${deviceId} synced with city: "${city}"`);

      if (!deviceId || deviceId.length > 128) {
        return res.status(400).json({ error: "Invalid deviceId" });
      }

      const syncData = this.deviceManager.handleDeviceSync(deviceId, position, req);

      res.json({
        serverTime: Date.now(),
        sessionId: syncData.session?.id || 'default',
        phase: syncData.session?.phase || 'idle',
        startAtMillis: syncData.session?.restartAt || null,
        requiredDevices: 1,
        confirmedDevices: this.deviceManager.getDeviceCount(),
        deviceId: deviceId,
        isMaster: syncData.isMaster || false,
        activeDevices: this.deviceManager.getDeviceCount(),
        recommendedAction: 'play',
        targetPositionMillis: position,
        remoteCommand: syncData.remoteCommand || null
      });
    } catch (error) {
      console.error("Sync error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  loadInitialData() {
    this.authService.cleanupExpiredTokens();
    console.log("🚀 Сервер инициализирован");
  }

  setupMiddleware() {
    this.app.set("trust proxy", 1);

    this.app.use(
      cors({
        origin: function (origin, callback) {
          // Разрешаем запросы без origin (например, из мобильных приложений)
          if (!origin) return callback(null, true);

          if (config.CORS_ORIGINS.indexOf(origin) !== -1) {
            callback(null, true);
          } else {
            console.log("CORS blocked for origin:", origin);
            callback(new Error("Not allowed by CORS"));
          }
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      })
    );

    this.app.use(express.json({ limit: "500mb" }));
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cookieParser());

    this.app.use("/api/login", authLimiter);
    this.app.use("/api/register", authLimiter);
    this.app.use("/api/", apiLimiter);
    this.app.use(morgan("combined"));
  }

  // Обновленный метод аутентификации
  handleAuth(req, res, next) {
    const PUBLIC_ROUTES = new Set([
      "/login",
      "/register",
      "/sync",
      "/confirm",
      "/health",
      "/check-auth", // Добавьте этот маршрут в публичные
    ]);
    const routePath = req.path.replace("/api", "");

    if (PUBLIC_ROUTES.has(routePath)) return next();

    // Для защищенных маршрутов проверяем аутентификацию
    this.authService.authenticateToken(req, res, next);
  }

  async handleRegister(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res
          .status(400)
          .json({ success: false, error: "Логин и пароль обязательны" });
      }

      const result = await this.authService.registerUser(username, password);
      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Register error:", error);
      res
        .status(500)
        .json({ success: false, error: "Внутренняя ошибка сервера" });
    }
  }

  setupRoutes() {
    // Публичные маршруты
    this.app.post("/api/login", validateLogin, this.handleLogin.bind(this));
    this.app.post("/api/logout", this.handleLogout.bind(this));
    this.app.post("/api/register", this.handleRegister.bind(this));
    this.app.get("/api/check-auth", this.handleCheckAuth.bind(this));
    this.app.get("/api/sync", this.handleSync.bind(this));
    this.app.post("/api/confirm", this.handleConfirm.bind(this));
    this.app.get("/api/health", this.handleHealth.bind(this));
    this.app.get("/api/script-progress", this.handleScriptProgress.bind(this));


    // Защищенные маршруты - применяем аутентификацию
    this.app.use("/api", this.handleAuth.bind(this));

    // Все маршруты ниже требуют аутентификации
    this.app.post(
      "/api/upload-video",
      validateCity,
      this.handleUploadVideo.bind(this)
    );
    this.app.post("/api/restart", validateCity, this.handleRestart.bind(this));
    this.app.get("/api/status", this.handleStatus.bind(this));
    this.app.get("/api/video-files", this.handleGetVideoFiles.bind(this));
    this.app.delete(
      "/api/video-files/:filename",
      this.handleDeleteVideo.bind(this)
    );
    this.app.post("/api/process-video", this.handleProcessVideo.bind(this));
    this.app.get("/api/script-status", this.handleScriptStatus.bind(this));
    this.app.post(
      "/api/device/:deviceId/command",
      this.handleDeviceCommand.bind(this)
    );
    this.app.get("/api/active-sessions", this.handleActiveSessions.bind(this));
    this.app.get("/api/download-logs", this.handleDownloadLoginLogs.bind(this));
    this.app.get("/api/action-logs", this.handleActionLogs.bind(this));
    this.app.get(
      "/api/download-action-logs",
      this.handleDownloadActionLogs.bind(this)
    );
    this.app.get("/api/user/settings", this.handleGetUserSettings.bind(this));
    this.app.put(
      "/api/user/settings",
      this.handleUpdateUserSettings.bind(this)
    );

    // Статические файлы и SPA роутинг
    const staticPath = path.join(__dirname, "..", "build");
    this.app.use(express.static(staticPath));
    this.app.get("*", (req, res) => {
      res.sendFile(path.join(staticPath, "index.html"));
    });

    this.app.use(this.handleErrors.bind(this));
  }

  // ===== ОБРАБОТЧИКИ =====
  handleConfirm(req, res) {
    try {
      const deviceId = String(req.body?.deviceId || "").trim();
      if (!deviceId) {
        return res.status(400).json({ error: "deviceId обязателен" });
      }
      const confirmData = this.deviceManager.handleDeviceConfirm(deviceId);
      res.json(confirmData);
    } catch (error) {
      console.error("Confirm error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  handleScriptProgress(req, res) {
    try {
      const status = this.scriptService.getStatus();
      res.json(status);
    } catch (error) {
      console.error("Script progress error:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения статуса скрипта",
        progress: 0,
        currentStep: 'Ошибка'
      });
    }
  }
  handleRestart(req, res) {
    try {
      const city = req.city;
      console.log(`=== RESTART REQUEST FOR CITY: ${city} ===`);

      const restartData = this.deviceManager.scheduleCountdown(city);

      // Логируем для отладки
      console.log(`Active devices in DeviceManager:`, Array.from(this.deviceManager.devices.values()).map(d => ({ id: d.id, city: d.city })));

      prisma.actionLog
        .create({
          data: {
            userId: req.user?.id || null,
            username: req.user?.username || "anonymous",
            role: req.user?.role || "guest",
            action: "restart_devices",
            details: { city: city },
            ip: getClientIp(req),
            userAgent: req.get("User-Agent"),
          },
        })
        .catch(console.error);
      res.json(restartData);
    } catch (error) {
      console.error("Restart error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  handleStatus(req, res) {
    try {
      const city = req.city;
      const status = this.deviceManager.getStatus(city);
      res.json(status);
    } catch (error) {
      console.error("Status error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async handleLogin(req, res) {
    try {
      console.log("Login attempt:", {
        username: req.body.username,
        origin: req.headers.origin,
      });

      const { username, password } = req.body;
      const userAgent = req.get("User-Agent");
      const ip = getClientIp(req);

      const result = await this.authService.login(
        username,
        password,
        ip,
        userAgent
      );

      if (result.success) {
        // Устанавливаем куку
        res.cookie("authToken", result.token, {
          httpOnly: true,
          secure: false,
          sameSite: "strict",
          maxAge: 24 * 60 * 60 * 1000,
          path: "/",
        });

        console.log("Cookie set successfully");

        // Логируем успешный вход - используем правильные поля из схемы
        await prisma.loginLog.create({
          data: {
            userId: result.user.id, // Прямое присвоение userId
            username,
            ip,
            userAgent,
          },
        });

        // Убираем токен из тела ответа для безопасности
        const { token, ...safeResult } = result;
        res.json(safeResult);
      } else {
        // Логируем неудачную попытку
        await prisma.loginLog.create({
          data: {
            username,
            ip,
            userAgent,
            // userId не указываем для неудачных попыток
          },
        });

        console.warn("Failed login attempt", { username, ip });
        res.status(401).json(result);
      }
    } catch (error) {
      console.error("Login error:", error);
      res
        .status(500)
        .json({ success: false, error: "Внутренняя ошибка сервера" });
    }
  }

  handleLogout(req, res) {
    try {
      // Очищаем куку
      res.clearCookie("authToken", {
        httpOnly: true,
        secure: false, // ✅ HTTP
        sameSite: "strict",
        path: "/",
      });

      this.authService.logout(req);
      res.json({ success: true, message: "Выход выполнен" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ success: false, error: "Ошибка при выходе" });
    }
  }

  handleCheckAuth(req, res) {
    try {
      // Проверяем токен из cookies или заголовка Authorization
      const token =
        req.cookies?.authToken ||
        (req.headers.authorization && req.headers.authorization.split(" ")[1]);

      if (!token) {
        return res.status(401).json({ authenticated: false });
      }

      jwt.verify(token, config.SECRET_KEY, (err, user) => {
        if (err) {
          return res.status(401).json({ authenticated: false });
        }
        res.json({
          authenticated: true,
          user: user,
        });
      });
    } catch (error) {
      console.error("Check auth error:", error);
      res.status(500).json({
        authenticated: false,
        error: error.message,
      });
    }
  }

  async handleGetVideoFiles(req, res) {
    try {
      const city = req.headers["x-city"] || "kurgan";
      const result = await this.videoService.getVideoFiles(city);
      res.json(result);
    } catch (error) {
      console.error("Get video files error:", error);
      res
        .status(500)
        .json({ success: false, message: "Ошибка получения списка видео" });
    }
  }

  async handleProcessVideo(req, res) {
    try {
      const city = req.body?.city || "kurgan";
      if (!config.CITY_CONFIG[city]) {
        return res
          .status(400)
          .json({ success: false, message: `Город ${city} не поддерживается` });
      }

      console.log(`=== ЗАПРОС НА ОБРАБОТКУ ВИДЕО ДЛЯ ${city} ===`);

      // ✅ Лог запуска скрипта
      await prisma.actionLog.create({
        data: {
          userId: req.user?.id || null,
          username: req.user?.username || "anonymous",
          role: req.user?.role || "guest",
          action: "run_concat_script",
          details: { city },
          ip: getClientIp(req),
          userAgent: req.get("User-Agent"),
        },
      });

      // Запускаем скрипт асинхронно
      this.scriptService
        .executeVideoScript(city)
        .then(() => console.log(`✅ СКРИПТ ВЫПОЛНЕН УСПЕШНО ДЛЯ ${city}`))
        .catch((error) =>
          console.error(`❌ ОШИБКА ВЫПОЛНЕНИЯ СКРИПТА ДЛЯ ${city}:`, error)
        );

      res.json({
        success: true,
        message: `Скрипт обработки видео запущен для города ${city}. Это может занять несколько минут.`,
      });
    } catch (error) {
      console.error("Process video error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  handleScriptStatus(req, res) {
    try {
      const status = this.scriptService.getStatus();
      res.json(status);
    } catch (error) {
      console.error("Script status error:", error);
      res
        .status(500)
        .json({ success: false, message: "Ошибка получения статуса скрипта" });
    }
  }

  handleDeviceCommand(req, res) {
    try {
      const deviceId = req.params.deviceId;
      const command = req.body?.command;

      if (!this.deviceManager.hasDevice(deviceId)) {
        return res.status(404).json({ error: "Device not found" });
      }

      this.deviceManager.sendCommandToDevice(deviceId, command);

      // ✅ Лог команды
      prisma.actionLog
        .create({
          data: {
            userId: req.user?.id || null,
            username: req.user?.username || "anonymous",
            role: req.user?.role || "guest",
            action: "send_command",
            details: { deviceId, command },
            ip: getClientIp(req),
            userAgent: req.get("User-Agent"),
          },
        })
        .catch(console.error);

      console.log(`[ADMIN] Command "${command}" sent to device ${deviceId}`);
      res.json({
        status: "command_sent",
        deviceId,
        command,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Device command error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async handleActiveSessions(req, res) {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "moderator") {
        return res.status(403).json({ error: "Доступ запрещён" });
      }
      const limit = parseInt(req.query.limit) || null;
      const logs = await prisma.loginLog.findMany({
        take: limit,
        orderBy: { timestamp: "desc" },
      });
      res.json({ sessions: logs });
    } catch (error) {
      console.error("Active sessions error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async handleActionLogs(req, res) {
    try {
      if (req.user?.role !== "admin" && req.user?.role !== "moderator") {
        return res.status(403).json({ error: "Доступ запрещён" });
      }
      const limit = parseInt(req.query.limit) || 50;
      const logs = await prisma.actionLog.findMany({
        take: limit,
        orderBy: { timestamp: "desc" },
      });
      res.json({ logs });
    } catch (error) {
      console.error("Action logs error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async handleDownloadLoginLogs(req, res) {
    try {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Доступ запрещён" });
      }
      const logs = await prisma.loginLog.findMany({
        orderBy: { timestamp: "desc" },
      });
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="login-logs.json"'
      );
      res.setHeader("Content-Type", "application/json");
      res.json(logs);
    } catch (error) {
      console.error("Download login logs error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async handleDownloadActionLogs(req, res) {
    try {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Доступ запрещён" });
      }
      const logs = await prisma.actionLog.findMany({
        orderBy: { timestamp: "desc" },
      });
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="action-logs.json"'
      );
      res.setHeader("Content-Type", "application/json");
      res.json(logs);
    } catch (error) {
      console.error("Download action logs error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async handleGetUserSettings(req, res) {
    try {
      const settings = await this.userService.getUserSettings(req.user.id);
      res.json({ success: true, settings });
    } catch (error) {
      console.error("Get user settings error:", error);
      res
        .status(500)
        .json({ success: false, error: "Ошибка получения настроек" });
    }
  }

  async handleUpdateUserSettings(req, res) {
    try {
      const { settings } = req.body;
      const updated = await this.userService.updateUserSettings(
        req.user.id,
        settings
      );
      res.json({
        success: true,
        message: "Настройки обновлены",
        settings: updated,
      });
    } catch (error) {
      console.error("Update user settings error:", error);
      res
        .status(500)
        .json({ success: false, error: "Ошибка обновления настроек" });
    }
  }

  async handleUploadVideo(req, res) {
    try {
      const city = req.headers["x-city"] || "kurgan";
      if (!config.CITY_CONFIG[city]) {
        return res
          .status(400)
          .json({ success: false, message: `Город ${city} не поддерживается` });
      }
      const result = await this.videoService.uploadVideo(req, res, city);
      if (result.success) {
        prisma.actionLog
          .create({
            data: {
              userId: req.user?.id || null,
              username: req.user?.username || "anonymous",
              role: req.user?.role || "guest",
              action: "upload_video",
              details: result.details,
              ip: getClientIp(req),
              userAgent: req.get("User-Agent"),
            },
          })
          .catch(console.error);
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Upload video error:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка загрузки файла: " + error.message,
      });
    }
  }

  async handleDeleteVideo(req, res) {
    try {
      const filename = req.params.filename;
      const city = req.query.city || "kurgan";

      // 🔒 Усиленная валидация имени файла
      if (
        filename.includes("..") ||
        filename.includes("/") ||
        filename.includes("\\") ||
        !/^[a-zA-Z0-9._-]+$/.test(filename)
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Некорректное имя файла" });
      }

      const result = await this.videoService.deleteVideoFile(filename, city);
      if (result.success) {
        prisma.actionLog
          .create({
            data: {
              userId: req.user?.id || null,
              username: req.user?.username || "anonymous",
              role: req.user?.role || "guest",
              action: "delete_video",
              details: { filename, city },
              ip: getClientIp(req),
              userAgent: req.get("User-Agent"),
            },
          })
          .catch(console.error);
        res.json(result);
      } else {
        res.status(404).json(result);
      }
    } catch (error) {
      console.error("Delete video error:", error);
      res
        .status(500)
        .json({ success: false, message: "Ошибка удаления файла" });
    }
  }

  handleHealth(req, res) {
    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      cities: Object.keys(config.CITY_CONFIG),
      activeDevices: this.deviceManager.getDeviceCount(),
      scriptRunning: this.scriptService.isRunning(),
    });
  }

  handleErrors(error, req, res, next) {
    console.error("Unhandled error:", {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
    });
    if (error.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ success: false, message: "Файл слишком большой..." });
    }
    res
      .status(500)
      .json({ success: false, message: "Внутренняя ошибка сервера" });
  }

  start() {
    this.app.listen(config.PORT, "0.0.0.0", () => {
      console.log(`✅ Sync server running on http://0.0.0.0:${config.PORT}`);
      console.log(
        `✅ Health check: http://localhost:${config.PORT}/api/health`
      );
      console.log(
        `✅ Поддерживаемые города: ${Object.keys(config.CITY_CONFIG).join(
          ", "
        )}`
      );
      console.log(`✅ CORS разрешены для: ${config.CORS_ORIGINS.join(", ")}`);
    });
    return this.app;
  }
}

if (require.main === module) {
  const server = new SyncServer();
  server.start();
}

module.exports = SyncServer;
