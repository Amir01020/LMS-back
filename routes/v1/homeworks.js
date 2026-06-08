const express = require('express');
const HomeworkController = require('../../controllers/homeworkController');
const { authenticateToken } = require('../../middleware/auth');
const { requireMentorOrAdmin } = require('../../middleware/roleCheck');

const router = express.Router();

router.use(authenticateToken);

router.get('/', HomeworkController.list);
router.post('/', requireMentorOrAdmin, HomeworkController.create);
router.patch('/:id', requireMentorOrAdmin, HomeworkController.update);
router.get('/:id/submissions', requireMentorOrAdmin, HomeworkController.getSubmissions);
router.post('/:id/submissions', HomeworkController.submit);
router.patch('/:id/submissions/:submissionId/review', requireMentorOrAdmin, HomeworkController.review);

module.exports = router;
