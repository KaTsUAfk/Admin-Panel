const Helpers = require("../utils/helpers");
const config = require("../config");

class DeviceManager {
  constructor() {
    this.devices = new Map();
    this.session = {
      id: null,
      phase: "idle",
      countdownEnd: null,
      restartAt: null,
    };
    this.lastMasterId = null;
  }

  handleDeviceSync(deviceId, position, req) {
    const now = Helpers.now();
    const city = req.query.city || req.body?.city || 'unknown';

    const device = this.devices.get(deviceId) || {
      id: deviceId,
      position: 0,
      lastSeen: now,
      isMaster: false,
      commands: [],
      city: city,
    };

    device.position = position;
    device.lastSeen = now;
    device.city = city;

    // Определяем мастер-устройство
    if (!this.lastMasterId || !this.devices.has(this.lastMasterId)) {
      this.lastMasterId = deviceId;
    }

    // Сбрасываем мастер статус у всех устройств
    for (const [id, dev] of this.devices) {
      dev.isMaster = id === this.lastMasterId;
    }

    device.isMaster = deviceId === this.lastMasterId;
    this.devices.set(deviceId, device);

    // Очищаем неактивные устройства
    this.cleanupInactiveDevices();

    const remoteCommand =
      device.commands.length > 0 ? device.commands[0] : null;

    if (device.commands.length > 0) {
      device.commands.shift(); // удаляем первую команду
    }
    return {
      session: this.session,
      position: device.position,
      isMaster: device.isMaster,
      remoteCommand: remoteCommand,
      //commands: device.command
    };
  }

  handleDeviceConfirm(deviceId) {
    const device = this.devices.get(deviceId);
    if (device) {
      device.commands = []; // Очищаем выполненные команды
    }

    return {
      session: this.session,
      confirmed: true,
    };
  }

  scheduleCountdown(city = null) {
    const now = Helpers.now();
    this.session = {
      id: `restart_${city}_${now}`,
      phase: "countdown",
      countdownEnd: now + config.DEVICE.COUNTDOWN_DELAY,
      restartAt: now + config.DEVICE.COUNTDOWN_DELAY,
    };

    console.log(`=== SCHEDULING COUNTDOWN FOR CITY: ${city} ===`);
    console.log(`Total devices: ${this.devices.size}`);

    let restartCount = 0;

    // Отправляем команду перезагрузки только устройствам указанного города
    for (const [deviceId, device] of this.devices) {
      console.log(`Checking device ${deviceId}: city=${device.city}, target=${city}`);

      // Если город указан - отправляем только устройствам этого города
      // Если город не указан - отправляем всем (для обратной совместимости)
      if (!city || device.city === city) {
        device.commands.push("restart");
        restartCount++;
        console.log(`✓ Sending restart to device: ${deviceId} in city: ${device.city}`);
      } else {
        console.log(`✗ Skipping device: ${deviceId} (city mismatch: ${device.city} != ${city})`);
      }
    }

    console.log(`Total devices restarted: ${restartCount} for city: ${city}`);

    // Запланировать фактический перезапуск
    setTimeout(() => {
      this.session.phase = "idle";
      this.session.countdownEnd = null;
      this.session.restartAt = null;
      console.log(`Countdown finished for city: ${city}`);
    }, config.DEVICE.COUNTDOWN_DELAY);

    return this.session;
  }
  cleanupInactiveDevices() {
    const now = Helpers.now();
    for (const [deviceId, device] of this.devices) {
      if (now - device.lastSeen > config.DEVICE.INACTIVE_THRESHOLD) {
        this.devices.delete(deviceId);
        if (deviceId === this.lastMasterId) {
          this.lastMasterId = null;
        }
      }
    }
  }

  hasDevice(deviceId) {
    return this.devices.has(deviceId);
  }

  sendCommandToDevice(deviceId, command) {
    const device = this.devices.get(deviceId);
    if (device) {
      device.commands.push(command);
    }
  }

  broadcastCommand(command, targetCity = null) {
    const devices = targetCity
      ? Array.from(this.devices.values()).filter(d => d.city === targetCity)
      : Array.from(this.devices.values());

    devices.forEach(device => {
      device.commands.push(command);
    });
  }

  getDeviceCount() {
    return this.devices.size;
  }

  getStatus(city = null) {
    let devices = Array.from(this.devices.values());

    // Фильтруем по городу, если указан
    if (city) {
      devices = devices.filter(d => d.city === city);
    }

    const devicesArray = devices.map((device) => ({
      id: device.id,
      position: device.position,
      lastSeen: device.lastSeen,
      isMaster: device.isMaster,
      commandCount: device.commands.length,
    }));

    return {
      status: "ok",
      serverTime: new Date().toISOString(),
      activeDevices: devices.length,
      session: this.session,
      devices: devicesArray,
    };
  }
}

module.exports = DeviceManager;
