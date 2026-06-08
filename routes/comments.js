const express = require('express');
const router = express.Router();

const commentController = require('../controllers/commentController');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin, requireAuth, requireTeacher } = require('../middleware/roleCheck');

// GET /api/comments - получить все комментарии (только админы)
router.get('/', authenticateToken, requireAdmin, commentController.getAllComments);

// GET /api/comments/unread - получить непрочитанные комментарии (только админы)
router.get('/unread', authenticateToken, requireAdmin, commentController.getUnreadComments);

// GET /api/comments/my - получить комментарии текущего учителя (только учителя)
router.get('/my', authenticateToken, requireTeacher, commentController.getMyComments);

// GET /api/comments/stats - получить статистику комментариев (только админы)
router.get('/stats', authenticateToken, requireAdmin, commentController.getCommentsStats);

// GET /api/comments/student/:studentId - получить комментарии о студенте (доступно всем авторизованным)
router.get('/student/:studentId', authenticateToken, requireAuth, commentController.getStudentComments);

// GET /api/comments/:id - получить комментарий по ID (доступно всем авторизованным)
router.get('/:id', authenticateToken, requireAuth, commentController.getCommentById);

// POST /api/comments - создать комментарий (только учителя)
router.post('/', authenticateToken, requireTeacher, commentController.createComment);

// PUT /api/comments/:id - обновить комментарий (автор или админы)
router.put('/:id', authenticateToken, requireAuth, commentController.updateComment);

// PATCH /api/comments/:id/mark-read - пометить комментарий как прочитанный (только админы)
router.patch('/:id/mark-read', authenticateToken, requireAdmin, commentController.markAsRead);

// PATCH /api/comments/mark-all-read - пометить все комментарии как прочитанные (только админы)
router.patch('/mark-all-read', authenticateToken, requireAdmin, commentController.markAllAsRead);

// DELETE /api/comments/:id - удалить комментарий (автор или админы)
router.delete('/:id', authenticateToken, requireAuth, commentController.deleteComment);

module.exports = router;