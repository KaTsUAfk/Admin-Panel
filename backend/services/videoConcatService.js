// backend/services/videoConcatService.js
const fs = require("fs").promises;
const path = require("path");
const { exec } = require("child_process");
const ffmpeg = require("fluent-ffmpeg");
const Logger = require("../utils/logger");

class VideoConcatService {
  constructor(cityConfig) {
    this.cityConfig = cityConfig;
    this.logger = new Logger(path.join(__dirname, "..", "concat-logs.json"));
    this.onProgress = null;
  }

  async run(city) {
    const config = this.cityConfig[city];
    if (!config) throw new Error(`Город ${city} не поддерживается`);

    const VIDEO_DIR = config.VIDEO_DIR; // Добавить
    const TEMP_DIR = path.join(VIDEO_DIR, "temp"); // Добавить
    const NGINX_HTML = config.NGINX_HTML; // Добавить
    const LOG_FILE = path.join(VIDEO_DIR, "concat.log"); // Добавить

    const totalSteps = 9; // Общее количество шагов
    let currentStep = 0;

    const updateProgress = (stepName) => {
      currentStep++;
      const progress = Math.round((currentStep / totalSteps) * 100);
      this._log(LOG_FILE, `Прогресс: ${progress}% - ${stepName}`);
      if (this.onProgress) {
        this.onProgress(progress, stepName);
      }
    };

    try {
      // 1. Удаляем старый input.mp4
      await this._safeUnlink(path.join(VIDEO_DIR, "input.mp4"));
      updateProgress('Подготовка файлов');

      // 2. Создаем временную папку
      await this._ensureDir(TEMP_DIR);
      updateProgress('Создание временных файлов');

      // 3. Получаем список видеофайлов
      const videoFiles = await this._getVideoFiles(VIDEO_DIR);
      if (videoFiles.length === 0) {
        this._log(LOG_FILE, "Нет видеофайлов для обработки");
        return;
      }
      updateProgress('Получение списка видео');

      // 4. Перекодируем файлы
      const convertedFiles = [];
      for (let i = 0; i < videoFiles.length; i++) {
        const inFile = path.join(VIDEO_DIR, videoFiles[i]);
        const outFile = path.join(TEMP_DIR, `converted_${i + 1}.mp4`);
        this._log(LOG_FILE, `Перекодирование: ${videoFiles[i]} → ${outFile}`);
        
        await this._transcodeToStandard(inFile, outFile);
        convertedFiles.push(outFile);
      }
      updateProgress('Перекодирование видео');

      // 5. Создаем list.txt
      const listPath = path.join(VIDEO_DIR, "list.txt");
      const listContent = convertedFiles.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join("\n");
      await fs.writeFile(listPath, listContent, "utf8");
      updateProgress('Создание плейлиста');

      // 6. Объединяем файлы
      const inputPath = path.join(VIDEO_DIR, "input.mp4");
      this._log(LOG_FILE, "Объединение файлов...");
      let success = await this._concatFiles(listPath, inputPath, false);
      if (!success) {
        success = await this._concatFiles(listPath, inputPath, true);
      }
      if (!success) throw new Error("Не удалось объединить видео");
      updateProgress('Объединение видео');

      // 7. Копируем в Nginx
      await this._ensureDir(NGINX_HTML);
      await fs.copyFile(inputPath, path.join(NGINX_HTML, "input.mp4"));
      this._log(LOG_FILE, "input.mp4 скопирован в Nginx");
      updateProgress('Копирование в Nginx');

      // 8. Генерируем HLS
      await this._generateHLS(path.join(NGINX_HTML, "input.mp4"), NGINX_HTML);
      await this._safeUnlink(path.join(NGINX_HTML, "input.mp4"));
      updateProgress('Генерация HLS');

      // 9. Очистка
      await fs.rm(TEMP_DIR, { recursive: true, force: true });
      await this._safeUnlink(listPath);
      await this._safeUnlink(inputPath);
      updateProgress('Очистка временных файлов');

      this._log(LOG_FILE, "Скрипт завершен успешно");
    } catch (err) {
      this._log(LOG_FILE, `Ошибка: ${err.message}`);
      throw err;
    }
  }


  async _transcodeToStandard(input, output) {
    const outputDir = path.dirname(output);
    try {
      // Проверяем доступ к папке
      await fs.access(outputDir, fs.constants.W_OK);
    } catch (error) {
      // Если нет доступа, создаем папку
      await this._ensureDir(outputDir);
    }

    // Проверяем существование входного файла
    try {
      await fs.access(input, fs.constants.R_OK);
    } catch (error) {
      throw new Error(`Входной файл не существует или недоступен: ${input}`);
    }

    return new Promise((resolve, reject) => {
      ffmpeg(input)
        .videoCodec("libx264")
        .audioCodec("aac")
        .size("1920x1080")
        .aspect("16:9")
        .fps(30)
        .audioBitrate("128k")
        .audioFrequency(44100)
        .outputOptions([
          "-preset medium",
          "-crf 23",
          '-vf',
          'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black',
        ])
        .on("end", resolve)
        .on("error", reject)
        .save(output);
    });
  }

    async _concatFiles(listPath, outputPath, reencode = false) {
    return new Promise((resolve, reject) => {
        // Проверяем существование list.txt
        fs.access(listPath)
        .then(() => {
            const cmd = ffmpeg()
            .input(listPath)
            .inputOptions(['-safe', '0'])
            .inputFormat('concat');

            if (reencode) {
            cmd
                .videoCodec("libx264")
                .audioCodec("aac")
                .outputOptions([
                "-preset", "medium",
                "-crf", "23",
                "-c:a", "aac", 
                "-b:a", "128k"
                ]);
            } else {
            cmd.outputOptions(["-c", "copy"]);
            }

            cmd
            .on("start", (commandLine) => {
                console.log(`🚀 FFmpeg concat command: ${commandLine}`);
            })
            .on("progress", (progress) => {
                console.log(`📊 Concat progress: ${Math.round(progress.percent)}%`);
            })
            .on("end", () => {
                console.log(`✅ Concatenation completed: ${outputPath}`);
                resolve(true);
            })
            .on("error", (err, stdout, stderr) => {
                console.error(`❌ FFmpeg concat error: ${err.message}`);
                console.error(`stderr: ${stderr}`);
                reject(err);
            })
            .save(outputPath);
        })
        .catch(err => {
            reject(new Error(`list.txt not accessible: ${err.message}`));
        });
    });
    }

  async _generateHLS(inputPath, outputDir) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .addOption("-hls_time", "5")
        .addOption("-hls_list_size", "0")
        .addOption("-hls_playlist_type", "vod")
        .addOption(
          "-hls_segment_filename",
          path.join(outputDir, "stream%03d.ts")
        )
        .videoCodec("libx264")
        .audioCodec("aac")
        .outputOptions([
          "-preset medium",
          "-crf 23",
          "-profile:v high",
          "-level 4.0",
          "-pix_fmt yuv420p",
          "-b:a 128k",
          "-ac 2",
        ])
        .on("end", resolve)
        .on("error", reject)
        .save(path.join(outputDir, "stream.m3u8"));
    });
  }

  async _getVideoFiles(dir) {
    const files = await fs.readdir(dir);
    return files
      .filter((f) => f.toLowerCase().endsWith(".mp4"))
      .filter(
        (f) => !f.startsWith(".") && f !== "input.mp4" && !f.includes("concat")
      );
  }

  async _ensureDir(dir) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async _safeUnlink(file) {
    try {
      await fs.unlink(file);
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }

  _getDayMonth() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${day}_${month}`;
  }

    _log(logFile, message) {
    const line = `[${new Date().toLocaleString("ru-RU")}] ${message}\n`;
    fs.appendFile(logFile, line, "utf8").catch(console.error);
    console.log(line.trim());
    }
}

module.exports = VideoConcatService;
