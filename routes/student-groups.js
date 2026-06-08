const express = require('express');
const router = express.Router();

const StudentGroupController = require('../controllers/studentGroupController');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin, requireAuth } = require('../middleware/roleCheck');

// GET /api/student-groups - получить все записи студент-группа (доступно всем авторизованным)
router.get('/', authenticateToken, requireAuth, StudentGroupController.getAllStudentGroups);

// GET /api/student-groups/student/:studentId - получить группы студента (доступно всем авторизованным)
router.get('/student/:studentId', authenticateToken, requireAuth, StudentGroupController.getStudentGroups);

// GET /api/student-groups/group/:groupId - получить студентов группы (доступно всем авторизованным)
router.get('/group/:groupId', authenticateToken, requireAuth, StudentGroupController.getGroupStudents);

// POST /api/student-groups - записать студента в группу (только админы)
router.post('/', authenticateToken, requireAdmin, StudentGroupController.enrollStudent);

// PATCH /api/student-groups/:id/deactivate - отчислить студента из группы (только админы)
router.patch('/:id/deactivate', authenticateToken, requireAdmin, StudentGroupController.deactivateEnrollment);

// PATCH /api/student-groups/:id/reactivate - восстановить студента в группе (только админы)
router.patch('/:id/reactivate', authenticateToken, requireAdmin, StudentGroupController.reactivateEnrollment);

// DELETE /api/student-groups/:id - полностью удалить запись (только админы)
router.delete('/:id', authenticateToken, requireAdmin, StudentGroupController.deleteEnrollment);

module.exports = router;