const Joi = require('joi');

const loginSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().min(6).required(),
  clientIp: Joi.string().ip().optional()
});

const videoUploadSchema = Joi.object({
  city: Joi.string().valid('kurgan', 'ekat').optional()
});

const validateLogin = (req, res, next) => {
  const { error } = loginSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ 
      success: false, 
      error: error.details[0].message 
    });
  }
  next();
};

const validateCity = (req, res, next) => {
  const { error } = videoUploadSchema.validate({ city: req.headers['x-city'] });
  if (error) {
    return res.status(400).json({ 
      success: false, 
      error: 'Некорректный город' 
    });
  }
  next();
};

module.exports = {
  validateLogin,
  validateCity
};