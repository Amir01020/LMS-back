const express = require('express');
const DirectionController = require('../../controllers/directionController');
const { authenticateToken } = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/roleCheck');

const router = express.Router();

router.use(authenticateToken);

router.get('/', DirectionController.list);
router.post('/', requireAdmin, DirectionController.create);
router.patch('/:id', requireAdmin, DirectionController.update);
router.delete('/:id', requireAdmin, DirectionController.remove);

module.exports = router;
