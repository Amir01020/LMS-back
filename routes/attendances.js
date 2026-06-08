const express = require('express');
const router = express.Router();

const AttendanceController = require('../controllers/attendanceController');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin, requireAuth, requireTeacher } = require('../middleware/roleCheck');

// GET /api/attendances - получить все записи посещаемости (доступно всем авторизованным)
router.get('/', authenticateToken, requireAuth, AttendanceController.getAllAttendances);

// GET /api/attendances/recent - получить недавнюю посещаемость (доступно всем авторизованным)
router.get('/recent', authenticateToken, requireAuth, AttendanceController.getRecentAttendance);

// GET /api/attendances/group/:groupId/date/:date - посещаемость группы за дату (доступно всем авторизованным)
router.get('/group/:groupId/date/:date', authenticateToken, requireAuth, AttendanceController.getGroupAttendanceForDate);

// GET /api/attendances/student/:studentId/stats - статистика посещаемости студента (доступно всем авторизованным)
router.get('/student/:studentId/stats', authenticateToken, requireAuth, AttendanceController.getStudentAttendanceStats);

// GET /api/attendances/group/:groupId/stats - статистика посещаемости группы (доступно всем авторизованным)
router.get('/group/:groupId/stats', authenticateToken, requireAuth, AttendanceController.getGroupAttendanceStats);

// POST /api/attendances/mark - отметить посещаемость (учителя и админы)
router.post('/mark', authenticateToken, requireAuth, AttendanceController.markAttendance);

// PUT /api/attendances/:id - обновить запись посещаемости (учителя и админы)
router.put('/:id', authenticateToken, requireAuth, AttendanceController.updateAttendance);

// DELETE /api/attendances/:id - удалить запись посещаемости (только админы)
router.delete('/:id', authenticateToken, requireAdmin, AttendanceController.deleteAttendance);

module.exports = router;