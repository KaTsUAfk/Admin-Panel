const config = require('../config');

const validateCity = (req, res, next) => {
  const city = req.headers['x-city'] || req.query.city || req.body.city || 'kurgan';
  if (!config.CITY_CONFIG[city]) {
    return res.status(400).json({
      success: false,
      message: `Город "${city}" не поддерживается`
    });
  }
  req.city = city;
  next();
};

module.exports = validateCity;