const express = require('express');
const FreezeRequestController = require('../../controllers/freezeRequestController');
const { authenticateToken } = require('../../middleware/auth');
const { requireManagerOrSupportStaff, requireRoles } = require('../../middleware/roleCheck');
const { USER_ROLES } = require('../../utils/constants');

const router = express.Router();

router.use(authenticateToken);

router.get('/', FreezeRequestController.list);
router.post('/', requireRoles(USER_ROLES.STUDENT), FreezeRequestController.create);
router.patch(
  '/:id/review',
  requireRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.MANAGER),
  FreezeRequestController.review
);

module.exports = router;
