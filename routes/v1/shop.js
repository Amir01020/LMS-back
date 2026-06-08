const express = require('express');
const ShopController = require('../../controllers/shopController');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdmin, requireManagerOrSupportStaff } = require('../../middleware/roleCheck');

const router = express.Router();

router.use(authenticateToken);

router.get('/items', ShopController.listItems);
router.post('/items', requireSuperAdmin, ShopController.createItem);
router.patch('/items/:id', requireSuperAdmin, ShopController.updateItem);
router.delete('/items/:id', requireSuperAdmin, ShopController.deleteItem);

router.get('/branches/:branchId/allocations', requireSuperAdmin, ShopController.listBranchAllocations);
router.put('/branches/:branchId/allocations', requireSuperAdmin, ShopController.setBranchAllocations);

router.post('/orders', ShopController.createOrder);
router.get('/orders', ShopController.listOrders);
router.patch('/orders/:id/issue', requireManagerOrSupportStaff, ShopController.issueOrder);

module.exports = router;
