const { exec } = require("child_process");
const path = require("path");
const config = require("../config");
const Logger = require("../utils/logger");

class ScriptService {
  constructor(cityConfig) {
    this.cityConfig = cityConfig;
    this.isRunning = false;
    this.currentProcess = null;
    this.logger = new Logger(path.join(__dirname, "..", "script-logs.json"));
  }

  executeVideoScript(city) {
    return new Promise((resolve, reject) => {
      if (this.isRunning) {
        this.logger.warn("Script already running", { city });
        return reject(new Error("Скрипт уже выполняется"));
      }

      const scriptPath = this.cityConfig[city]?.SCRIPT_PATH;

      if (!scriptPath) {
        console.log("City not supported", { city });
        return reject(new Error(`Город ${city} не поддерживается`));
      }

      this.isRunning = true;
      console.log("Starting video script", { city, scriptPath });

      this.currentProcess = exec(
        scriptPath,
        { cwd: path.dirname(scriptPath) },
        (error, stdout, stderr) => {
          this.isRunning = false;
          this.currentProcess = null;

          if (error) {
            console.log("Script execution failed", {
              city,
              error: error.message,
            });
            reject(error);
            return;
          }

          console.log("Script completed successfully", { city });
          resolve({ success: true, stdout, stderr });
        }
      );

      setTimeout(() => {
        if (this.isRunning && this.currentProcess) {
          console.log("Script timeout", { city });
          this.currentProcess.kill();
          this.isRunning = false;
          this.currentProcess = null;
          reject(new Error("Скрипт превысил время выполнения"));
        }
      }, 300000);
    });
  }

  getStatus() {
    return {
      status: this.isRunning ? "running" : "idle",
      isRunning: this.isRunning,
    };
  }

  isScriptRunning() {
    return this.isRunning;
  }
}

module.exports = ScriptService;
