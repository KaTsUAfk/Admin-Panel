const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Helpers = require('../utils/helpers');
const config = require('../config');

const SALT_ROUNDS = 12; // достаточно для безопасности

class AuthService {
  constructor(usersFilePath, activeTokensPath) {
    this.usersFilePath = usersFilePath;
    this.activeTokensPath = activeTokensPath;
    this.users = this.loadUsers();
    this.activeTokens = new Set(Helpers.loadJsonFile(this.activeTokensPath, []));
  }

    loadUsers() {
    return Helpers.loadJsonFile(this.usersFilePath, [
      {
        id: 1,
        username: 'admin',
        passwordHash: bcrypt.hashSync('admin', SALT_ROUNDS),
        role: 'admin'
      }
    ]);
  }

  saveUsers() {
    return Helpers.saveJsonFile(this.usersFilePath, this.users);
  }

  saveActiveTokens() {
    const tokensArray = Array.from(this.activeTokens);
    return Helpers.saveJsonFile(this.activeTokensPath, tokensArray);
  }

  cleanupExpiredTokens() {
    const validTokens = new Set();
    
    for (const token of this.activeTokens) {
      try {
        jwt.verify(token, config.SECRET_KEY);
        validTokens.add(token);
      } catch (err) {
        console.log('Удален истекший токен');
      }
    }
    
    if (validTokens.size !== this.activeTokens.size) {
      this.activeTokens = validTokens;
      this.saveActiveTokens();
      console.log(`Очищено устаревших токенов. Осталось валидных: ${this.activeTokens.size}`);
    }
  }

  async login(username, password, ip, userAgent) {
    const user = this.users.find(u => u.username === username);
    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      return { success: false, error: 'Неверный логин или пароль' };
    }

    const token = jwt.sign(
      { id: user.id, 
        username: user.username, 
        role: user.role || 'user' 
      },
      config.SECRET_KEY,
      { expiresIn: '24h' }
    );

    this.activeTokens.add(token);
    this.saveActiveTokens();

    return {
      success: true,
      message: 'Вход выполнен',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role || 'user'
      }
    };
  }

async register(username, password) {
    if (this.users.find(u => u.username === username)) {
      return { success: false, error: 'Пользователь уже существует' };
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = {
      id: this.users.length + 1,
      username,
      passwordHash, // ← не сохраняем plain password!
      role: 'user'
    };
    this.users.push(newUser);
    this.saveUsers();
    
    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, role: 'user' }, 
      config.SECRET_KEY, 
      { expiresIn: '24h' }
    );
    
    this.activeTokens.add(token);
    this.saveActiveTokens();
    
    return {
      success: true,
      message: 'Регистрация успешна',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        role: 'user'
      }
    };
  }


  authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    jwt.verify(token, config.SECRET_KEY, (err, user) => {
      if (err) {
        console.error('JWT verification error:', err);
        return res.status(403).json({ error: 'Неверный токен' });
      }
      
      if (!this.activeTokens.has(token)) {
        return res.status(403).json({ error: 'Сессия завершена' });
      }
      
      req.user = user;
      next();
    });
  }
  

  logout(req) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token && this.activeTokens.has(token)) {
      this.activeTokens.delete(token);
      this.saveActiveTokens();
      console.log(`Токен удален из активных сессий. Осталось токенов: ${this.activeTokens.size}`);
    }
  }
}



module.exports = AuthService;