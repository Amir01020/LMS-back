const express = require('express');
const FinanceController = require('../../controllers/financeController');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdmin } = require('../../middleware/roleCheck');

const router = express.Router();

router.use(authenticateToken, requireSuperAdmin);

router.get('/employees', FinanceController.listEmployees);
router.patch('/employees/:userId', FinanceController.setEmployeeSalary);

router.get('/payments', FinanceController.listSalaryPayments);
router.post('/payments/generate', FinanceController.generateSalaryPayments);
router.patch('/payments/:id', FinanceController.updateSalaryPayment);

router.put('/branches/:branchId/budget', FinanceController.setBudget);
router.get('/branches/:branchId/budgets', FinanceController.listBudgets);
router.post('/branches/:branchId/income', FinanceController.addIncome);
router.get('/branches/:branchId/income', FinanceController.listIncome);
router.get('/branches/:branchId/overview', FinanceController.branchFinanceOverview);

module.exports = router;
