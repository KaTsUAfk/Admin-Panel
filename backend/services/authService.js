const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("../config");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

class AuthService {
  async login(username, password, ip, userAgent) {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return { success: false, error: "Неверный логин или пароль" };
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      config.SECRET_KEY,
      { expiresIn: "24h" }
    );

    // Сохраняем токен в памяти
    if (!global.activeTokens) global.activeTokens = new Set();
    global.activeTokens.add(token);

    return {
      success: true,
      message: "Вход выполнен",
      token,
      user: { id: user.id, username: user.username, role: user.role },
    };
  }

  async registerUser(username, password) {
    try {
      // Проверка уникальности
      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing) {
        return { success: false, error: "Пользователь уже существует" };
      }

      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      const user = await prisma.user.create({
        data: {
          username,
          passwordHash: hashedPassword,
          role: "moderator", // или "user" — по умолчанию
        },
        select: { id: true, username: true, role: true },
      });

      return { success: true, user };
    } catch (error) {
      console.error("Registration failed:", error);
      return { success: false, error: "Ошибка при создании пользователя" };
    }
  }

  logout(req) {
    const authHeader = req.headers["authorization"];
    const token = authHeader?.split(" ")[1];
    if (token && global.activeTokens?.has(token)) {
      global.activeTokens.delete(token);
    }
  }

  authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    // Также проверяем токен из cookies
    const cookieToken = req.cookies?.authToken;
    const finalToken = token || cookieToken;

    if (!finalToken) {
      return res
        .status(401)
        .json({ success: false, error: "Токен отсутствует" });
    }

    jwt.verify(finalToken, config.SECRET_KEY, (err, user) => {
      if (err) {
        return res
          .status(403)
          .json({ success: false, error: "Неверный или просроченный токен" });
      }
      req.user = user;
      next();
    });
  }

  // Методы для проверки токена (используются на клиенте)
  static isAuthenticated(token) {
    if (!token) return false;

    try {
      const decoded = jwt.decode(token);
      return decoded && decoded.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  static getTokenExpiry(token) {
    if (!token) return null;

    try {
      const decoded = jwt.decode(token);
      return decoded ? decoded.exp * 1000 : null;
    } catch {
      return null;
    }
  }

  // Метод для проверки валидности токена (на сервере)
  verifyToken(token) {
    try {
      return jwt.verify(token, config.SECRET_KEY);
    } catch {
      return null;
    }
  }

  cleanupExpiredTokens() {
    if (!global.activeTokens) return;
    const validTokens = new Set();
    for (const token of global.activeTokens) {
      try {
        jwt.verify(token, config.SECRET_KEY);
        validTokens.add(token);
      } catch { }
    }
    global.activeTokens = validTokens;
  }
}

module.exports = AuthService;
