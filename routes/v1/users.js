const express = require('express');
const UserController = require('../../controllers/userController');
const { authenticateToken } = require('../../middleware/auth');
const { requireAdmin, requireAdminOrSupport } = require('../../middleware/roleCheck');
const { uploadAvatar, handleUploadError } = require('../../middleware/uploadAvatar');

const router = express.Router();

router.use(authenticateToken);

router.get('/', requireAdminOrSupport, UserController.list);
router.post('/', requireAdmin, UserController.create);
router.get('/:id', UserController.getById);
router.post(
  '/:id/avatar',
  authenticateToken,
  (req, res, next) => uploadAvatar(req, res, (err) => handleUploadError(err, req, res, next)),
  UserController.uploadAvatar
);
router.patch('/:id', requireAdmin, UserController.update);
router.delete('/:id', requireAdmin, UserController.archive);

module.exports = router;
