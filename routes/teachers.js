const express = require('express');
const router = express.Router();

const TeacherController = require('../controllers/teacherController');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin, requireAuth, requireTeacher } = require('../middleware/roleCheck');

// GET /api/teachers - получить всех учителей (доступно всем авторизованным)
router.get('/', authenticateToken, requireAuth, TeacherController.getAllTeachers);

// GET /api/teachers/active - получить активных учителей (доступно всем авторизованным)
router.get('/active', authenticateToken, requireAuth, TeacherController.getActiveTeachers);

// GET /api/teachers/my-profile - получить свой профиль (только учителя)
router.get('/my-profile', authenticateToken, requireTeacher, TeacherController.getMyProfile);

// GET /api/teachers/:id - получить учителя по ID (доступно всем авторизованным)
router.get('/:id', authenticateToken, requireAuth, TeacherController.getTeacherById);

// POST /api/teachers - создать нового учителя (только админы)
router.post('/', authenticateToken, requireAdmin, TeacherController.createTeacher);

// PUT /api/teachers/:id - обновить учителя (только админы)
router.put('/:id', authenticateToken, requireAdmin, TeacherController.updateTeacher);

// PATCH /api/teachers/:id/toggle-status - переключить активность (только админы)
router.patch('/:id/toggle-status', authenticateToken, requireAdmin, TeacherController.toggleTeacherStatus);

// DELETE /api/teachers/:id - удалить учителя (только админы)
router.delete('/:id', authenticateToken, requireAdmin, TeacherController.deleteTeacher);

module.exports = router;