const express = require('express');
const DirectionController = require('../../controllers/directionController');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdmin } = require('../../middleware/roleCheck');

const router = express.Router();

router.use(authenticateToken);

router.get('/', DirectionController.list);
router.post('/', requireSuperAdmin, DirectionController.create);
router.patch('/:id', requireSuperAdmin, DirectionController.update);
router.delete('/:id', requireSuperAdmin, DirectionController.remove);

module.exports = router;
