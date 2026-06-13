const express = require('express');
const rateLimit = require('express-rate-limit');
const AuthController = require('../../controllers/authController');
const { authenticateToken } = require('../../middleware/auth');
const { uploadAvatar, handleUploadError } = require('../../middleware/uploadAvatar');
const authConfig = require('../../config/auth');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: authConfig.rateLimit.auth.windowMs,
  max: authConfig.rateLimit.auth.max,
  message: { success: false, message: 'Слишком много попыток, попробуйте позже' }
});

router.post('/login', authLimiter, AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);
router.post('/forgot-password', authLimiter, AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);
router.patch('/change-password', authenticateToken, AuthController.changePassword);
router.get('/me', authenticateToken, AuthController.me);
router.patch('/profile', authenticateToken, AuthController.updateProfile);
router.post(
  '/avatar',
  authenticateToken,
  (req, res, next) => uploadAvatar(req, res, (err) => handleUploadError(err, req, res, next)),
  AuthController.uploadAvatar
);

module.exports = router;
