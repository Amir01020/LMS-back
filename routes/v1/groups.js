const express = require('express');
const GroupController = require('../../controllers/groupController');
const { authenticateToken } = require('../../middleware/auth');
const { requireManagerOnly } = require('../../middleware/roleCheck');

const router = express.Router();

router.use(authenticateToken);

router.get('/', GroupController.list);
router.post('/', requireManagerOnly, GroupController.create);
router.get('/:id', GroupController.getById);
router.patch('/:id', requireManagerOnly, GroupController.update);
router.delete('/:id', requireManagerOnly, GroupController.remove);
router.get('/:id/stats', GroupController.getStats);
router.get('/:id/members/:userId/stats', GroupController.getMemberStats);
router.get('/:id/students', GroupController.getStudents);
router.post('/:id/students/:userId', requireManagerOnly, GroupController.addStudent);
router.delete('/:id/students/:userId', requireManagerOnly, GroupController.removeStudent);
router.post('/transfer-student', requireManagerOnly, GroupController.transferStudent);

module.exports = router;
