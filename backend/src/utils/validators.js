const Joi = require('joi');

const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid('admin', 'organizer', 'player'), // admin creation should be locked down in production
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const tournamentSchema = Joi.object({
  name: Joi.string().min(3).max(150).required(),
  type: Joi.string().valid('knockout', 'round_robin', 'group_knockout').required(),
  max_participants: Joi.number().integer().min(2).max(128).default(16),
  start_date: Joi.date().iso().allow(null),
  end_date: Joi.date().iso().allow(null),
});

const predictionSchema = Joi.object({
  matchId: Joi.number().integer().required(),
  predictedWinnerId: Joi.number().integer().required(),
});

// Generic middleware factory: validate req.body against any Joi schema
const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    const message = error.details.map((d) => d.message).join(', ');
    return res.status(400).json({ success: false, message });
  }
  req.body = value;
  next();
};

module.exports = { registerSchema, loginSchema, tournamentSchema, predictionSchema, validate };
