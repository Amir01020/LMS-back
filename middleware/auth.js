const AuthService = require('../services/authService');
const { User } = require('../models');
const { USER_ROLES, HTTP_STATUS, ERROR_MESSAGES } = require('../utils/constants');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.TOKEN_REQUIRED
      });
    }

    const decoded = AuthService.verifyAccessToken(token);
    const user = await User.findByPk(decoded.userId);

    if (!user || !user.is_active) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.INVALID_TOKEN
      });
    }

    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      branchId: user.branch_id || null,
      branchIds: []
    };

    if ([USER_ROLES.MANAGER, USER_ROLES.MENTOR, USER_ROLES.SUPPORT].includes(user.role)) {
      const BranchAccessService = require('../services/branchAccessService');
      req.user.branchIds = await BranchAccessService.getUserBranchIds(user.id);
      if (!req.user.branchId && req.user.branchIds.length) {
        req.user.branchId = req.user.branchIds[0];
      }
    }

    next();
  } catch (error) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: error.message || ERROR_MESSAGES.INVALID_TOKEN
    });
  }
};

module.exports = { authenticateToken };
