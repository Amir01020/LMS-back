const express = require('express');
const BranchController = require('../../controllers/branchController');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdmin } = require('../../middleware/roleCheck');

const router = express.Router();

router.use(authenticateToken, requireSuperAdmin);

router.get('/stats/overview', BranchController.allStats);
router.get('/students/stats', BranchController.studentStatsOverview);
router.get('/students', BranchController.listStudents);
router.get('/', BranchController.list);
router.post('/', BranchController.create);
router.get('/:id', BranchController.getById);
router.patch('/:id', BranchController.update);
router.delete('/:id', BranchController.archive);
router.get('/:id/stats', BranchController.stats);

module.exports = router;
