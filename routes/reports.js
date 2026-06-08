// routes/reports.js
const express = require('express');
const router = express.Router();

const reportController = require('../controllers/reportController');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin, requireAuth } = require('../middleware/roleCheck');

// Добавляем логирование для отладки
router.use((req, res, next) => {
  console.log(`Reports route accessed: ${req.method} ${req.originalUrl}`);
  next();
});

// Тестовый маршрут для проверки работы
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Reports routes working!',
    timestamp: new Date().toISOString()
  });
});

// GET /api/reports/revenue - общий доход за период (доступно всем авторизованным)
router.get('/revenue', authenticateToken, requireAuth, reportController.getRevenueReport);

// GET /api/reports/course-revenue - доход по курсам (доступно всем авторизованным)
router.get('/course-revenue', authenticateToken, requireAuth, reportController.getCourseRevenueReport);

// GET /api/reports/teacher-salary - отчет для расчета зарплаты учителей (только админы)
router.get('/teacher-salary', authenticateToken, requireAdmin, reportController.getTeacherSalaryReport);

// GET /api/reports/debtors - отчет по должникам для модалки админа (только админы)
router.get('/debtors', authenticateToken, requireAdmin, reportController.getDebtorsReport);

// GET /api/reports/dashboard - общая статистика для дашборда (доступно всем авторизованным)
router.get('/dashboard', authenticateToken, requireAuth, reportController.getDashboardStats);

module.exports = router;