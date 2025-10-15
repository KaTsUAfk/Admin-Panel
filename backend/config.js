console.log('Environment variables:', {
  PORT: process.env.PORT,
  SECRET_KEY: process.env.SECRET_KEY ? 'SET' : 'NOT SET',
  KURGAN_VIDEO_DIR: process.env.KURGAN_VIDEO_DIR ? 'SET' : 'NOT SET',
  EXAT_VIDEO_DIR: process.env.EKAT_VIDEO_DIR ? 'SET' : 'NOT SET'
});

// Проверка обязательных переменных
const requiredEnvVars = ['SECRET_KEY'];
requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    throw new Error(`${envVar} не задан в переменных окружения!`);
  }
});

const config = {
  PORT: process.env.PORT || 3000,
  SECRET_KEY: process.env.SECRET_KEY,
  
  CORS_ORIGINS: [
    'http://localhost:3001',
    'http://10.1.241.65:3001',
    'http://127.0.0.1:3001',
    'http://o.av45.ru:3001',
    'http://109.195.134.244:3001'
  ],
  
  CITY_CONFIG: {
    kurgan: {
      VIDEO_DIR: process.env.KURGAN_VIDEO_DIR || 'K:\\bik-service\\kurgan',
      SCRIPT_PATH: process.env.KURGAN_SCRIPT_PATH || 'K:\\bik-service\\kurgan\\concat.bat',
      HLS_URL: process.env.KURGAN_HLS_URL || 'http://109.195.134.244:8096/kurgan'
    },
    ekat: {
      VIDEO_DIR: process.env.EKAT_VIDEO_DIR || 'K:\\bik-service\\ekat',
      SCRIPT_PATH: process.env.EKAT_SCRIPT_PATH || 'K:\\bik-service\\ekat\\concat.bat',
      HLS_URL: process.env.EKAT_HLS_URL || 'http://109.195.134.244:8096/ekat'
    }
  },
  
  UPLOAD: {
    MAX_FILE_SIZE: 500 * 1024 * 1024,
    ALLOWED_MIME_TYPES: ['video/']
  },
  
  DEVICE: {
    INACTIVE_THRESHOLD: 30000,
    COUNTDOWN_DELAY: 10000
  }
};

module.exports = config;