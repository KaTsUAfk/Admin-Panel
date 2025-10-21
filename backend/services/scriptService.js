const path = require("path");
const config = require("../config");
const Logger = require("../utils/logger");
const VideoConcatService = require("./videoConcatService"); // ← выносим импорт наверх

class ScriptService {
  constructor(cityConfig) {
    this.cityConfig = cityConfig;
    this.isRunning = false;
    this.progress = 0;
    this.currentStep = '';
    this.logger = new Logger(path.join(__dirname, "..", "script-logs.json"));
  }

  async executeVideoScript(city) {
    if (this.isRunning) {
      this.logger.warn("Script already running", { city });
      throw new Error("Скрипт уже выполняется");
    }

    const scriptPath = this.cityConfig[city]?.SCRIPT_PATH;
    if (!scriptPath) {
      console.log("City not supported", { city });
      throw new Error(`Город ${city} не поддерживается`);
    }

    this.isRunning = true;
    this.progress = 0;
    this.currentStep = 'Подготовка файлов';
    console.log("Starting video script via Node.js service", { city });

    const concatService = new VideoConcatService(this.cityConfig);

    // Добавляем обработчики прогресса
    concatService.onProgress = (progress, step) => {
      this.progress = progress;
      this.currentStep = step;
      console.log(`Progress: ${progress}% - ${step}`);
    };

    try {
      await concatService.run(city);
      this.progress = 100;
      this.currentStep = 'Завершено';
      console.log("Video script completed successfully", { city });
      return { success: true };
    } catch (error) {
      this.progress = 0;
      this.currentStep = 'Ошибка';
      console.error("Video script failed", { city, error: error.message });
      throw error;
    } finally {
      setTimeout(() => {
        this.isRunning = false;
        this.progress = 0;
        this.currentStep = '';
      }, 2000);
    }
  }

  getStatus() {
    return {
      status: this.isRunning ? "running" : "idle",
      isRunning: this.isRunning,
      progress: this.progress,
      currentStep: this.currentStep
    };
  }

  isScriptRunning() {
    return this.isRunning;
  }
}


// this.currentProcess = exec(
//   scriptPath,
//   { cwd: path.dirname(scriptPath) },
//   (error, stdout, stderr) => {
//     this.isRunning = false;
//     this.currentProcess = null;

//     if (error) {
//       console.log("Script execution failed", {
//         city,
//         error: error.message,
//       });
//       reject(error);
//       return;
//     }

//     console.log("Script completed successfully", { city });
//     resolve({ success: true, stdout, stderr });
//   }
// );

module.exports = ScriptService;
