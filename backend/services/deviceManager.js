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

  handleDeviceSync(deviceId, position) {
    const now = Helpers.now();
    const device = this.devices.get(deviceId) || {
      id: deviceId,
      position: 0,
      lastSeen: now,
      isMaster: false,
      commands: [],
    };

    device.position = position;
    device.lastSeen = now;

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

  scheduleCountdown() {
    const now = Helpers.now();
    this.session = {
      id: "restart_" + now,
      phase: "countdown",
      countdownEnd: now + config.DEVICE.COUNTDOWN_DELAY,
      restartAt: now + config.DEVICE.COUNTDOWN_DELAY,
    };

    // Отправляем команду перезагрузки всем устройствам
    for (const [deviceId, device] of this.devices) {
      device.commands.push("restart");
    }

    // Запланировать фактический перезапуск
    setTimeout(() => {
      this.session.phase = "idle";
      this.session.countdownEnd = null;
      this.session.restartAt = null;
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

  getDeviceCount() {
    return this.devices.size;
  }

  getStatus() {
    const devicesArray = Array.from(this.devices.values()).map((device) => ({
      id: device.id,
      position: device.position,
      lastSeen: device.lastSeen,
      isMaster: device.isMaster,
      commandCount: device.commands.length,
    }));

    return {
      status: "ok",
      serverTime: new Date().toISOString(),
      activeDevices: this.devices.size,
      session: this.session,
      devices: devicesArray,
    };
  }
}

module.exports = DeviceManager;
