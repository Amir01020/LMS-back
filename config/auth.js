require('dotenv').config();

module.exports = {
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'change_access_secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change_refresh_secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    algorithm: 'HS256'
  },
  bcrypt: {
    saltRounds: 12
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 100,
    auth: {
      windowMs: 15 * 60 * 1000,
      max: 10
    }
  }
};
