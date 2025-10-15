const Helpers = require('../utils/helpers');
const path = require('path');

class UserService {
  constructor(usersFilePath) {
    this.usersFilePath = usersFilePath;
    this.users = this.loadUsers();
  }

  loadUsers() {
    return Helpers.loadJsonFile(this.usersFilePath, []);
  }

  saveUsers() {
    return Helpers.saveJsonFile(this.usersFilePath, this.users);
  }

  updateUserSettings(userId, settings) {
    const user = this.users.find(u => u.id === userId);
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    // Инициализируем settings если их нет
    if (!user.settings) {
      user.settings = {};
    }

    // Обновляем настройки
    Object.assign(user.settings, settings);
    this.saveUsers();

    return user;
  }

  getUserSettings(userId) {
    const user = this.users.find(u => u.id === userId);
    return user?.settings || { darkMode: false };
  }
}

module.exports = UserService;