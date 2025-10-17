// backend/services/userService.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

class UserService {
  async updateUserSettings(userId, settings) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("Пользователь не найден");

    const updated = await prisma.userSettings.upsert({
      where: { userId },
      update: { darkMode: settings.darkMode },
      create: { userId, darkMode: settings.darkMode },
    });

    return updated;
  }

  async getUserSettings(userId) {
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });
    return settings || { darkMode: false };
  }
}

module.exports = UserService;
