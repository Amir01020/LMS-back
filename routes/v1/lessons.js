const express = require('express');
const LessonController = require('../../controllers/lessonController');
const { authenticateToken } = require('../../middleware/auth');
const { requireMentorOrAdmin } = require('../../middleware/roleCheck');

const router = express.Router();

router.use(authenticateToken);

router.get('/', LessonController.list);
router.post('/', requireMentorOrAdmin, LessonController.create);
router.get('/:id', LessonController.getById);
router.patch('/:id', requireMentorOrAdmin, LessonController.update);
router.delete('/:id', requireMentorOrAdmin, LessonController.remove);
router.post('/:id/video', requireMentorOrAdmin, LessonController.uploadVideo);
router.get('/:id/video', LessonController.getVideo);
router.post('/:id/materials', requireMentorOrAdmin, LessonController.addMaterial);
router.get('/:id/comments', LessonController.getComments);
router.post('/:id/comments', LessonController.addComment);
router.post('/:id/attendance', requireMentorOrAdmin, LessonController.markAttendance);

module.exports = router;
