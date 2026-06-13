const express = require('express');
const ShopController = require('../../controllers/shopController');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdmin, requireManagerOrSupportStaff } = require('../../middleware/roleCheck');
const { uploadShopImage, handleUploadError } = require('../../middleware/uploadShopImage');

const router = express.Router();

router.use(authenticateToken);

router.get('/items', ShopController.listItems);
router.post('/items', requireSuperAdmin, ShopController.createItem);
router.patch('/items/:id', requireSuperAdmin, ShopController.updateItem);
router.post(
  '/items/:id/image',
  requireSuperAdmin,
  (req, res, next) => uploadShopImage(req, res, (err) => handleUploadError(err, req, res, next)),
  ShopController.uploadItemImage
);
router.delete('/items/:id', requireSuperAdmin, ShopController.deleteItem);

router.get('/branches/:branchId/allocations', requireSuperAdmin, ShopController.listBranchAllocations);
router.put('/branches/:branchId/allocations', requireSuperAdmin, ShopController.setBranchAllocations);

router.post('/orders', ShopController.createOrder);
router.get('/orders', ShopController.listOrders);
router.patch('/orders/:id/issue', requireManagerOrSupportStaff, ShopController.issueOrder);

module.exports = router;
