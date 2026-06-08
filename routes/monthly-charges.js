const express = require('express');
const router = express.Router();

const monthlyChargeController = require('../controllers/monthlyChargeController');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin, requireAuth } = require('../middleware/roleCheck');

// GET /api/monthly-charges - получить все ежемесячные списания (доступно всем авторизованным)
router.get('/', authenticateToken, requireAuth, monthlyChargeController.getAllCharges);

// GET /api/monthly-charges/pending - получить списания к обработке (только админы)
router.get('/pending', authenticateToken, requireAdmin, monthlyChargeController.getPendingCharges);

// GET /api/monthly-charges/overdue - получить просроченные списания (только админы)
router.get('/overdue', authenticateToken, requireAdmin, monthlyChargeController.getOverdueCharges);

// GET /api/monthly-charges/stats - получить статистику списаний (доступно всем авторизованным)
router.get('/stats', authenticateToken, requireAuth, monthlyChargeController.getChargesStats);

// GET /api/monthly-charges/student/:studentId - получить списания студента (доступно всем авторизованным)
router.get('/student/:studentId', authenticateToken, requireAuth, monthlyChargeController.getStudentCharges);

// GET /api/monthly-charges/:id - получить списание по ID (доступно всем авторизованным)
router.get('/:id', authenticateToken, requireAuth, monthlyChargeController.getChargeById);

// POST /api/monthly-charges - создать списание для студента (только админы)
router.post('/', authenticateToken, requireAdmin, monthlyChargeController.createCharge);

// POST /api/monthly-charges/create-monthly - создать ежемесячные списания для всех (только админы)
router.post('/create-monthly', authenticateToken, requireAdmin, monthlyChargeController.createMonthlyCharges);

// POST /api/monthly-charges/:id/process - обработать конкретное списание (только админы)
router.post('/:id/process', authenticateToken, requireAdmin, monthlyChargeController.processCharge);

// POST /api/monthly-charges/process-pending - обработать все готовые списания (только админы)
router.post('/process-pending', authenticateToken, requireAdmin, monthlyChargeController.processPendingCharges);

// PATCH /api/monthly-charges/:id/cancel - отменить списание (только админы)
router.patch('/:id/cancel', authenticateToken, requireAdmin, monthlyChargeController.cancelCharge);

// DELETE /api/monthly-charges/:id - удалить списание (только админы)
router.delete('/:id', authenticateToken, requireAdmin, monthlyChargeController.deleteCharge);

module.exports = router;