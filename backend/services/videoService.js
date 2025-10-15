const fs = require("fs");
const path = require("path");
const multer = require("multer");
const Helpers = require("../utils/helpers");
const config = require("../config");
const AppError = require("../utils/AppError");
const cacheService = require("./cacheService");

class VideoService {
  constructor(cityConfig) {
    this.cityConfig = cityConfig;
    this.upload = this.setupMulter();
  }

  setupMulter() {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const city = req.headers["x-city"] || "kurgan";
        const videoDir = this.cityConfig[city]?.VIDEO_DIR;

        if (!videoDir) {
          return cb(new Error(`Город ${city} не поддерживается`));
        }

        // Создаем директорию если не существует
        if (!fs.existsSync(videoDir)) {
          fs.mkdirSync(videoDir, { recursive: true });
        }

        cb(null, videoDir);
      },
      filename: (req, file, cb) => {
        const originalName = path.parse(file.originalname).name;
        const extension = path.extname(file.originalname);
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);
        const safeFilename = `${originalName}_${timestamp}_${random}${extension}`;
        cb(null, safeFilename);
      },
    });

    return multer({
      storage: storage,
      limits: {
        fileSize: config.UPLOAD.MAX_FILE_SIZE,
      },
      fileFilter: (req, file, cb) => {
        if (
          file.mimetype.startsWith("video/") ||
          file.originalname.toLowerCase().endsWith(".mp4")
        ) {
          cb(null, true);
        } else {
          cb(new Error("Разрешены только видеофайлы"), false);
        }
      },
    });
  }

  async uploadVideo(req, res, city) {
    return new Promise((resolve, reject) => {
      this.upload.single("video")(req, res, (err) => {
        if (err) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return resolve({
              success: false,
              message: "Файл слишком большой. Максимальный размер: 500MB",
            });
          }
          return resolve({
            success: false,
            message: err.message,
          });
        }

        if (!req.file) {
          return resolve({
            success: false,
            message: "Файл не был загружен",
          });
        }

        resolve({
          success: true,
          message: "Файл успешно загружен",
          details: {
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            city: city,
          },
        });
      });
    });
  }

  async getVideoFiles(city) {
    const cacheKey = `videos_${city}`;

    // Пробуем получить из кэша
    const cached = cacheService.get(cacheKey);
    if (cached) {
      console.log("📦 Возвращаем видеофайлы из кэша");
      return cached;
    }
    try {
      const videoDir = this.cityConfig[city]?.VIDEO_DIR;

      if (!videoDir || !fs.existsSync(videoDir)) {
        return { success: true, files: [] };
      }

      const files = fs
        .readdirSync(videoDir)
        .map((filename) => {
          const filePath = path.join(videoDir, filename);
          try {
            const stats = fs.statSync(filePath);
            return {
              name: filename,
              size: stats.size,
              modified: stats.mtime.toISOString(),
              path: filePath,
            };
          } catch (error) {
            return {
              name: filename,
              size: 0,
              modified: new Date().toISOString(),
              error: error.message,
            };
          }
        })
        .filter(
          (file) =>
            !file.name.startsWith(".") &&
            !file.name.includes("concat") &&
            file.name.toLowerCase() !== "input.mp4" &&
            (file.name.toLowerCase().endsWith(".mp4") ||
              file.name.toLowerCase().endsWith(".ts"))
        )
        .sort((a, b) => new Date(b.modified) - new Date(a.modified));

      const result = { success: true, files };

      // Сохраняем в кэш
      cacheService.set(cacheKey, result, 60); // 1 минута для файлов

      return result;
    } catch (error) {
      return {
        success: false,
        message: "Ошибка чтения директории: " + error.message,
      };
    }
  }

  async deleteVideoFile(filename, city) {
    try {
      const videoDir = this.cityConfig[city]?.VIDEO_DIR;

      if (!videoDir) {
        return {
          success: false,
          message: `Город ${city} не поддерживается`,
        };
      }

      // Защита от path traversal
      if (
        filename.includes("..") ||
        filename.includes("/") ||
        filename.includes("\\")
      ) {
        return {
          success: false,
          message: "Некорректное имя файла",
        };
      }

      const filePath = path.join(videoDir, filename);

      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          message: "Файл не найден",
        };
      }

      fs.unlinkSync(filePath);

      cacheService.del(`videos_${city}`);

      return {
        success: true,
        message: "Файл успешно удален",
      };
    } catch (error) {
      return {
        success: false,
        message: "Ошибка удаления файла: " + error.message,
      };
    }
  }
}

module.exports = VideoService;
