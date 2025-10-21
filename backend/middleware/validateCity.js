const validateCity = (req, res, next) => {
  // Получаем город из разных источников
  const city = req.body?.city || req.query?.city || req.headers['x-city'];

  if (!city) {
    return res.status(400).json({
      success: false,
      error: 'Город не указан'
    });
  }

  // Нормализуем название города
  const normalizedCity = city.toLowerCase().trim();

  // Проверяем поддерживается ли город
  const supportedCities = ['kurgan', 'ekat']; // или из config
  if (!supportedCities.includes(normalizedCity)) {
    return res.status(400).json({
      success: false,
      error: `Город ${city} не поддерживается`
    });
  }

  // Устанавливаем город в request
  req.city = normalizedCity;
  next();
};

module.exports = validateCity;