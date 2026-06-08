const express = require('express');
const router = express.Router();

const StudentController = require('../controllers/studentController');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin, requireAuth } = require('../middleware/roleCheck');

// GET /api/students - получить всех студентов (доступно всем авторизованным)
router.get('/', authenticateToken, requireAuth, StudentController.getAllStudents);

// GET /api/students/debtors - получить должников (доступно всем авторизованным)
router.get('/debtors', authenticateToken, requireAuth, StudentController.getDebtors);

// GET /api/students/active - получить активных студентов (доступно всем авторизованным)
router.get('/active', authenticateToken, requireAuth, StudentController.getActiveStudents);

// GET /api/students/:id - получить студента по ID (доступно всем авторизованным)
router.get('/:id', authenticateToken, requireAuth, StudentController.getStudentById);

// POST /api/students - создать нового студента (только админы)
router.post('/', authenticateToken, requireAdmin, StudentController.createStudent);

// PUT /api/students/:id - обновить студента (только админы)
router.put('/:id', authenticateToken, requireAdmin, StudentController.updateStudent);

// PATCH /api/students/:id/status - изменить статус студента (только админы)
router.patch('/:id/status', authenticateToken, requireAdmin, StudentController.updateStudentStatus);

// PATCH /api/students/:id/balance - пополнить/списать баланс (только админы)
router.patch('/:id/balance', authenticateToken, requireAdmin, StudentController.updateBalance);

// DELETE /api/students/:id - удалить студента (только админы)
router.delete('/:id', authenticateToken, requireAdmin, StudentController.deleteStudent);

module.exports = router;