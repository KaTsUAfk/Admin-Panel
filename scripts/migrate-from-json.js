// scripts/migrate-from-json.js
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();
const BACKEND_DIR = path.join(__dirname, "..", "backend");

async function migrate() {
  console.log("🚀 Начинаем миграцию из JSON в SQLite...");

  // === Пользователи и их настройки ===
  const usersPath = path.join(BACKEND_DIR, "users.json");
  const users = JSON.parse(fs.readFileSync(usersPath, "utf8") || "[]");

  for (const user of users) {
    // 1. Создаём или обновляем пользователя
    const upsertedUser = await prisma.user.upsert({
      where: { username: user.username },
      update: {
        passwordHash: user.passwordHash,
        role: user.role || "user",
        createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
      },
      create: {
        username: user.username,
        passwordHash: user.passwordHash,
        role: user.role || "user",
        createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
      },
    });

    // 2. Если есть настройки — создаём/обновляем UserSettings
    if (user.settings) {
      await prisma.userSettings.upsert({
        where: { userId: upsertedUser.id },
        update: {
          darkMode: Boolean(user.settings.darkMode),
        },
        create: {
          userId: upsertedUser.id,
          darkMode: Boolean(user.settings.darkMode),
        },
      });
    }
  }
  console.log(`✅ Мигрировано пользователей: ${users.length}`);

  // === Логи входов ===
  const loginLogsPath = path.join(BACKEND_DIR, "login-logs.json");
  const loginLogs = JSON.parse(fs.readFileSync(loginLogsPath, "utf8") || "[]");
  for (const log of loginLogs) {
    await prisma.loginLog.create({
      data: {
        userId: log.userId || null,
        username: log.username || "unknown",
        ip: log.ip || null,
        userAgent: log.userAgent || null,
        timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
      },
    });
  }
  console.log(`✅ Мигрировано логов входа: ${loginLogs.length}`);

  // === Логи действий ===
  const actionLogsPath = path.join(BACKEND_DIR, "action-logs.json");
  const actionLogs = JSON.parse(
    fs.readFileSync(actionLogsPath, "utf8") || "[]"
  );
  for (const log of actionLogs) {
    await prisma.actionLog.create({
      data: {
        userId: log.userId || null,
        username: log.username || "unknown",
        role: log.role || "user",
        action: log.action,
        details: log.details || undefined,
        ip: log.ip || null,
        userAgent: log.userAgent || null,
        timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
      },
    });
  }
  console.log(`✅ Мигрировано логов действий: ${actionLogs.length}`);

  console.log("🎉 Миграция завершена!");
  await prisma.$disconnect();
}

migrate().catch(async (e) => {
  console.error("❌ Ошибка миграции:", e);
  await prisma.$disconnect();
  process.exit(1);
});
