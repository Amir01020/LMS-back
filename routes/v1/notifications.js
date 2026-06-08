const express = require('express');
const NotificationController = require('../../controllers/notificationController');
const { authenticateToken } = require('../../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/', NotificationController.list);
router.patch('/:id/read', NotificationController.markRead);
router.post('/read-all', NotificationController.markAllRead);

module.exports = router;
