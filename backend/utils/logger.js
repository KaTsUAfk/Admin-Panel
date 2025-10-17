// backend/utils/logger.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

class Logger {
  async logAction(req, action, details = {}) {
    const user = req.user;
    const ip =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      "unknown";
    const userAgent = req.get("User-Agent");

    await prisma.actionLog.create({
      data: {
        userId: user?.id || null,
        username: user?.username || "anonymous",
        role: user?.role || "guest",
        action,
        details: details || undefined,
        ip,
        userAgent,
      },
    });
  }

  async getActionLogs(limit = 50) {
    return prisma.actionLog.findMany({
      take: limit,
      orderBy: { timestamp: "desc" },
    });
  }

  async getLoginLogs(limit = null) {
    const query = { orderBy: { timestamp: "desc" } };
    if (limit) query.take = limit;
    return prisma.loginLog.findMany(query);
  }

  async cleanupOldLogs(days = 7) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const deleted = await prisma.actionLog.deleteMany({
      where: { timestamp: { lt: cutoff } },
    });
    const deleted2 = await prisma.loginLog.deleteMany({
      where: { timestamp: { lt: cutoff } },
    });
    console.log(`🧹 Удалено ${deleted.count + deleted2.count} старых записей`);
  }
}

module.exports = Logger;
