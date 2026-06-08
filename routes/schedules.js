const express = require('express');
const router = express.Router();

const ScheduleController = require('../controllers/scheduleController');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin, requireAuth, requireTeacher } = require('../middleware/roleCheck');

// GET /api/schedules - получить все расписания (доступно всем авторизованным)
router.get('/', authenticateToken, requireAuth, ScheduleController.getAllSchedules);

// GET /api/schedules/today - получить расписание на сегодня (доступно всем авторизованным)
router.get('/today', authenticateToken, requireAuth, ScheduleController.getTodaySchedule);

// GET /api/schedules/my-today - получить расписание текущего учителя на сегодня (только учителя)
router.get('/my-today', authenticateToken, requireTeacher, ScheduleController.getMyTodaySchedule);

// GET /api/schedules/group/:groupId - получить расписание группы (доступно всем авторизованным)
router.get('/group/:groupId', authenticateToken, requireAuth, ScheduleController.getGroupSchedule);

// GET /api/schedules/:id - получить расписание по ID (доступно всем авторизованным)
router.get('/:id', authenticateToken, requireAuth, ScheduleController.getScheduleById);

// POST /api/schedules - создать новое расписание (только админы)
router.post('/', authenticateToken, requireAdmin, ScheduleController.createSchedule);

// PUT /api/schedules/:id - обновить расписание (только админы)
router.put('/:id', authenticateToken, requireAdmin, ScheduleController.updateSchedule);

// DELETE /api/schedules/:id - удалить расписание (только админы)
router.delete('/:id', authenticateToken, requireAdmin, ScheduleController.deleteSchedule);

module.exports = router;