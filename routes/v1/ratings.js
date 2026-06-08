const express = require('express');
const RatingController = require('../../controllers/ratingController');
const { authenticateToken } = require('../../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.post('/:id/ratings', RatingController.rateMentor);
router.get('/:id/ratings', RatingController.getMentorRatings);

module.exports = router;
