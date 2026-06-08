const { USER_ROLES, HTTP_STATUS } = require('../utils/constants');

const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: 'Требуется авторизация'
    });
  }
  next();
};

const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: 'Требуется авторизация'
    });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      message: 'Доступ запрещен'
    });
  }

  next();
};

const requireSuperAdmin = requireRoles(USER_ROLES.SUPER_ADMIN);
const requireManager = requireRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.MANAGER);
const requireManagerOnly = requireRoles(USER_ROLES.MANAGER);
const requireManagerOrSupport = requireRoles(
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.MANAGER,
  USER_ROLES.SUPPORT
);
const requireManagerOrSupportStaff = requireRoles(
  USER_ROLES.MANAGER,
  USER_ROLES.SUPPORT
);
const requireMentorOrManager = requireRoles(
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.MANAGER,
  USER_ROLES.MENTOR
);
const requireStudent = requireRoles(USER_ROLES.STUDENT);

module.exports = {
  requireAuth,
  requireRoles,
  requireSuperAdmin,
  requireManager,
  requireAdmin: requireManager,
  requireManagerOnly,
  requireAdminOnly: requireManagerOnly,
  requireManagerOrSupport,
  requireManagerOrSupportStaff,
  requireAdminOrSupport: requireManagerOrSupport,
  requireMentorOrManager,
  requireMentorOrAdmin: requireMentorOrManager,
  requireStudent
};
