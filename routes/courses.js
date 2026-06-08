const express = require('express');
const router = express.Router();

const CourseController = require('../controllers/courseController');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin, requireAuth } = require('../middleware/roleCheck');

// GET /api/courses - получить все курсы (доступно всем авторизованным)
router.get('/', authenticateToken, requireAuth, CourseController.getAllCourses);

// GET /api/courses/:id - получить курс по ID (доступно всем авторизованным)
router.get('/:id', authenticateToken, requireAuth, CourseController.getCourseById);

// POST /api/courses - создать новый курс (только админы)
router.post('/', authenticateToken, requireAdmin, CourseController.createCourse);

// PUT /api/courses/:id - обновить курс (только админы)
router.put('/:id', authenticateToken, requireAdmin, CourseController.updateCourse);

// DELETE /api/courses/:id - удалить курс (только админы)
router.delete('/:id', authenticateToken, requireAdmin, CourseController.deleteCourse);

// PATCH /api/courses/:id/toggle-status - переключить статус курса (только админы)
router.patch('/:id/toggle-status', authenticateToken, requireAdmin, CourseController.toggleCourseStatus);

module.exports = router;