require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { testConnection } = require('./config/database');
const { syncDatabase } = require('./models');
const authConfig = require('./config/auth');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    console.log('🚀 Запуск School LMS API...');

    const isConnected = await testConnection();
    if (!isConnected) {
      console.error('❌ Не удалось подключиться к базе данных');
      process.exit(1);
    }

    const forceSync = process.env.DB_FORCE_SYNC === 'true';
    await syncDatabase(forceSync);

    const app = express();

    app.use(helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }
    }));
    app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true
    }));
    app.use(morgan('combined'));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
      setHeaders(res) {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
      }
    }));

    const limiter = rateLimit({
      windowMs: authConfig.rateLimit.windowMs,
      max: authConfig.rateLimit.max
    });
    app.use('/api', limiter);
    app.use('/api', apiRoutes);

    app.get('/', (req, res) => {
      res.json({
        success: true,
        message: 'School LMS Platform API',
        version: '1.0.0',
        docs: '/api/v1/health'
      });
    });

    app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Маршрут не найден',
        path: req.originalUrl
      });
    });

    app.use(errorHandler);

    const server = app.listen(PORT, () => {
      console.log(`✅ Сервер запущен: http://localhost:${PORT}`);
      console.log(`📡 API: http://localhost:${PORT}/api/v1`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Порт ${PORT} уже занят другим процессом`);
        console.error('   Остановите старый сервер (Ctrl+C) или выполните:');
        console.error(`   Get-NetTCPConnection -LocalPort ${PORT} | Select OwningProcess`);
        console.error('   Stop-Process -Id <PID> -Force');
      } else {
        console.error('❌ Ошибка запуска сервера:', error.message);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Ошибка запуска:', error.message);
    process.exit(1);
  }
};

startServer();

process.on('SIGINT', async () => {
  const { sequelize } = require('./models');
  await sequelize.close();
  process.exit(0);
});
