const fs = require('fs');
const path = require('path');

class Helpers {
  static getClientIp(req) {
    return req.headers['x-forwarded-for'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           'unknown';
  }

  static now() {
    return Date.now();
  }

  static toInt(x, def = 0) {
    if (x == null) return def;
    const n = Number.parseInt(x, 10);
    return Number.isFinite(n) ? n : def;
  }

  static loadJsonFile(filePath, defaultValue = []) {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    } catch (e) {
      console.error(`Ошибка загрузки ${filePath}:`, e);
    }
    return defaultValue;
  }

  static saveJsonFile(filePath, data) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error(`Ошибка сохранения ${filePath}:`, e);
      return false;
    }
  }
}

module.exports = Helpers;