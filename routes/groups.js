const express = require('express');
const router = express.Router();

const GroupController = require('../controllers/groupController');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin, requireAuth, requireTeacher } = require('../middleware/roleCheck');

// GET /api/groups - получить все группы (доступно всем авторизованным)
router.get('/', authenticateToken, requireAuth, GroupController.getAllGroups);

// GET /api/groups/active - получить активные группы (доступно всем авторизованным)
router.get('/active', authenticateToken, requireAuth, GroupController.getActiveGroups);

// GET /api/groups/my - получить группы текущего учителя (только учителя)
router.get('/my', authenticateToken, requireTeacher, GroupController.getMyGroups);

// GET /api/groups/:id - получить группу по ID (доступно всем авторизованным)
router.get('/:id', authenticateToken, requireAuth, GroupController.getGroupById);

// POST /api/groups - создать новую группу (только админы)
router.post('/', authenticateToken, requireAdmin, GroupController.createGroup);

// PUT /api/groups/:id - обновить группу (только админы)
router.put('/:id', authenticateToken, requireAdmin, GroupController.updateGroup);

// PATCH /api/groups/:id/toggle-status - переключить активность группы (только админы)
router.patch('/:id/toggle-status', authenticateToken, requireAdmin, GroupController.toggleGroupStatus);

// DELETE /api/groups/:id - удалить группу (только админы)
router.delete('/:id', authenticateToken, requireAdmin, GroupController.deleteGroup);

module.exports = router;