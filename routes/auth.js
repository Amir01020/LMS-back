const express = require('express');
const router = express.Router();

const AuthController = require('../controllers/authController');
const { authenticateToken, requireGuest } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleCheck');

// POST /api/auth/login - вход в систему
router.post('/login', requireGuest, AuthController.login);

// POST /api/auth/register - регистрация нового пользователя (только админы)
router.post('/register', authenticateToken, requireAdmin, AuthController.register);

// GET /api/auth/me - получить информацию о текущем пользователе
router.get('/me', authenticateToken, AuthController.getCurrentUser);

// POST /api/auth/change-password - изменить пароль
router.post('/change-password', authenticateToken, AuthController.changePassword);

// POST /api/auth/logout - выход из системы
router.post('/logout', authenticateToken, AuthController.logout);

// GET /api/auth/verify - проверить токен
router.get('/verify', authenticateToken, AuthController.verifyToken);

module.exports = router;