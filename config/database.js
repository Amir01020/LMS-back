const { Sequelize } = require('sequelize');
require('dotenv').config();

const dialect = process.env.DB_DIALECT || 'mysql';

const baseConfig = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || (dialect === 'postgres' ? 5432 : 3306),
  dialect,
  logging: process.env.DB_LOGGING === 'true' ? console.log : false,
  define: {
    timestamps: true,
    underscored: true
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
};

if (dialect === 'postgres') {
  baseConfig.dialectOptions = {
    ssl: process.env.DB_SSL === 'true' ? { require: true, rejectUnauthorized: false } : false
  };
} else {
  baseConfig.timezone = '+05:00';
  baseConfig.define.charset = 'utf8mb4';
  baseConfig.define.collate = 'utf8mb4_unicode_ci';
}

const env = process.env.NODE_ENV || 'development';
const config = {
  development: { ...baseConfig },
  production: {
    ...baseConfig,
    logging: false,
    pool: { max: 20, min: 5, acquire: 30000, idle: 10000 }
  }
};

const currentConfig = config[env] || config.development;

const sequelize = new Sequelize(
  currentConfig.database,
  currentConfig.username,
  currentConfig.password,
  currentConfig
);

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log(`✅ Подключение к ${dialect.toUpperCase()} установлено`);
    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения к БД:', error.message);
    return false;
  }
};

module.exports = { sequelize, testConnection, config: currentConfig };
