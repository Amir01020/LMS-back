const express = require('express');
const router = express.Router();

const cronController = require('../controllers/cronController');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleCheck');

// GET /api/cron/status - получить статус всех cron-задач (только админы)
router.get('/status', authenticateToken, requireAdmin, cronController.getStatus);

// POST /api/cron/start - запустить сервис cron-задач (только админы)
router.post('/start', authenticateToken, requireAdmin, cronController.startService);

// POST /api/cron/stop - остановить сервис cron-задач (только админы)
router.post('/stop', authenticateToken, requireAdmin, cronController.stopService);

// POST /api/cron/run/:taskName - запустить конкретную задачу вручную (только админы)
router.post('/run/:taskName', authenticateToken, requireAdmin, cronController.runTask);

module.exports = router;