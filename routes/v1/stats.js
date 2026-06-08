const express = require('express');
const StatsController = require('../../controllers/statsController');
const { authenticateToken } = require('../../middleware/auth');
const { requireAdmin, requireRoles } = require('../../middleware/roleCheck');
const { USER_ROLES } = require('../../utils/constants');

const router = express.Router();

router.use(authenticateToken);

router.get('/students', StatsController.studentStats);
router.get('/mentors', requireRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.MANAGER, USER_ROLES.SUPPORT, USER_ROLES.MENTOR), StatsController.mentorStats);
router.get('/overview', requireAdmin, StatsController.overview);

module.exports = router;
