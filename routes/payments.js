const express = require('express');
const router = express.Router();

const PaymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin, requireAuth } = require('../middleware/roleCheck');

// GET /api/payments - получить все платежи (доступно всем авторизованным)
router.get('/', authenticateToken, requireAuth, PaymentController.getAllPayments);

// GET /api/payments/revenue - получить статистику доходов (доступно всем авторизованным)
router.get('/revenue', authenticateToken, requireAuth, PaymentController.getRevenueStats);

// GET /api/payments/debtors - получить должников (доступно всем авторизованным)
router.get('/debtors', authenticateToken, requireAuth, PaymentController.getDebtors);

// GET /api/payments/student/:studentId - получить платежи студента (доступно всем авторизованным)
router.get('/student/:studentId', authenticateToken, requireAuth, PaymentController.getStudentPayments);

// GET /api/payments/:id - получить платеж по ID (доступно всем авторизованным)
router.get('/:id', authenticateToken, requireAuth, PaymentController.getPaymentById);

// POST /api/payments/deposit - пополнить баланс студента (только админы)
router.post('/deposit', authenticateToken, requireAdmin, PaymentController.createDeposit);

// POST /api/payments/charge - списать средства со студента (только админы)
router.post('/charge', authenticateToken, requireAdmin, PaymentController.createCharge);

// POST /api/payments/refund - вернуть средства студенту (только админы)
router.post('/refund', authenticateToken, requireAdmin, PaymentController.createRefund);

// DELETE /api/payments/:id - удалить платеж (только админы)
router.delete('/:id', authenticateToken, requireAdmin, PaymentController.deletePayment);

module.exports = router;