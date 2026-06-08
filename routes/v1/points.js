const express = require('express');
const PointsController = require('../../controllers/pointsController');
const { authenticateToken } = require('../../middleware/auth');
const { requireMentorOrAdmin } = require('../../middleware/roleCheck');

const router = express.Router();

router.use(authenticateToken);

router.get('/:id', PointsController.getPoints);
router.post('/:id', requireMentorOrAdmin, PointsController.addPoints);

module.exports = router;
