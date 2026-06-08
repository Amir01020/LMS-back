const AuthService = require('../services/authService');
const { HTTP_STATUS, SUCCESS_MESSAGES } = require('../utils/constants');
const { sendSuccess, sendError } = require('../utils/response');

class AuthController {
  static async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return sendError(res, 'Email и пароль обязательны', HTTP_STATUS.BAD_REQUEST);
      }
      const result = await AuthService.login(email, password);
      return sendSuccess(res, result, SUCCESS_MESSAGES.LOGIN_SUCCESS);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.UNAUTHORIZED);
    }
  }

  static async refresh(req, res) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return sendError(res, 'Refresh token обязателен', HTTP_STATUS.BAD_REQUEST);
      }
      const result = await AuthService.refresh(refreshToken);
      return sendSuccess(res, result);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.UNAUTHORIZED);
    }
  }

  static async logout(req, res) {
    try {
      const { refreshToken } = req.body;
      const result = await AuthService.logout(refreshToken);
      return sendSuccess(res, result);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      if (!email) return sendError(res, 'Email обязателен', HTTP_STATUS.BAD_REQUEST);
      const result = await AuthService.forgotPassword(email);
      return sendSuccess(res, result);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async resetPassword(req, res) {
    try {
      const { email, code, newPassword } = req.body;
      if (!email || !code || !newPassword) {
        return sendError(res, 'Email, код и новый пароль обязательны', HTTP_STATUS.BAD_REQUEST);
      }
      const result = await AuthService.resetPassword(email, code, newPassword);
      return sendSuccess(res, result);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async changePassword(req, res) {
    try {
      const { oldPassword, newPassword } = req.body;
      if (!oldPassword || !newPassword) {
        return sendError(res, 'Старый и новый пароль обязательны', HTTP_STATUS.BAD_REQUEST);
      }
      const result = await AuthService.changePassword(req.user.userId, oldPassword, newPassword);
      return sendSuccess(res, result);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async me(req, res) {
    try {
      const user = await AuthService.getUserById(req.user.userId);
      return sendSuccess(res, { user });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.NOT_FOUND);
    }
  }

  static async updateProfile(req, res) {
    try {
      const { name, email, phone, avatar_url } = req.body;
      const user = await AuthService.updateProfile(req.user.userId, {
        name,
        email,
        phone,
        avatar_url
      });
      return sendSuccess(res, { user }, 'Профиль обновлён');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }
}

module.exports = AuthController;
