const {
  USER_ROLES,
  STAFF_ROLES,
  ROLES_CREATABLE_BY_MANAGER,
  ROLES_CREATABLE_BY_SUPER_ADMIN
} = require('../utils/constants');

class UserRoleService {
  static isSuperAdmin(user) {
    return user.role === USER_ROLES.SUPER_ADMIN;
  }

  static isManager(user) {
    return user.role === USER_ROLES.MANAGER;
  }

  static isManagement(user) {
    return this.isSuperAdmin(user) || this.isManager(user);
  }

  static canCreateRole(actor, targetRole) {
    if (this.isSuperAdmin(actor)) {
      return ROLES_CREATABLE_BY_SUPER_ADMIN.includes(targetRole);
    }
    if (this.isManager(actor)) {
      return ROLES_CREATABLE_BY_MANAGER.includes(targetRole);
    }
    return false;
  }

  static canAssignRole(actor, targetRole) {
    return this.canCreateRole(actor, targetRole);
  }

  static requiresBranch(role) {
    return [
      USER_ROLES.MANAGER,
      USER_ROLES.MENTOR,
      USER_ROLES.SUPPORT
    ].includes(role);
  }

  static validateCreateUser(actor, { role, branch_id, branch_ids }) {
    if (!this.canCreateRole(actor, role)) {
      throw new Error('У вас нет прав создавать пользователя с этой ролью');
    }

    const resolvedBranches = this.resolveBranchIds(actor, branch_ids, branch_id, role);

    if (this.isManager(actor)) {
      if (role !== USER_ROLES.STUDENT) {
        throw new Error('Менеджер может создавать только студентов');
      }
    }

    if (this.isSuperAdmin(actor) && role === USER_ROLES.STUDENT) {
      throw new Error('Супер-админ не может создавать студентов');
    }

    if (this.isSuperAdmin(actor) && role === USER_ROLES.MANAGER && !resolvedBranches.length) {
      throw new Error('Для менеджера необходимо указать филиал');
    }

    if (this.requiresBranch(role) && this.isSuperAdmin(actor) && !resolvedBranches.length) {
      throw new Error('Для сотрудника необходимо указать филиал');
    }

    return resolvedBranches;
  }

  static validateUpdateUser(actor, targetUser, updates) {
    if (updates.role && !this.canAssignRole(actor, updates.role)) {
      throw new Error('У вас нет прав назначать эту роль');
    }

    if (this.isManager(actor)) {
      if (targetUser.role !== USER_ROLES.STUDENT) {
        throw new Error('Менеджер может изменять только студентов');
      }
      if (updates.role && updates.role !== USER_ROLES.STUDENT) {
        throw new Error('Менеджер не может назначать роли сотрудников');
      }
    }

    if (this.isSuperAdmin(actor)) {
      if (targetUser.role === USER_ROLES.STUDENT && updates.role && updates.role !== USER_ROLES.STUDENT) {
        throw new Error('Супер-админ не управляет студентами через редактирование роли');
      }
      if (updates.role === USER_ROLES.STUDENT) {
        throw new Error('Супер-админ не может назначать роль студента');
      }
      if (updates.role === USER_ROLES.MANAGER) {
        const hasBranch = updates.branch_ids?.length || updates.branch_id || targetUser.branch_id;
        if (!hasBranch) throw new Error('Для менеджера необходимо указать филиал');
      }
    }
  }

  static resolveBranchIds(actor, branch_ids, branch_id, role) {
    if (this.isManager(actor)) {
      return actor.branchIds?.length ? actor.branchIds : (actor.branchId ? [actor.branchId] : []);
    }

    if (Array.isArray(branch_ids) && branch_ids.length) {
      return branch_ids.filter(Boolean).map(Number);
    }

    if (branch_id) return [Number(branch_id)];

    return [];
  }

  static resolveBranchId(actor, requestedBranchId, role) {
    const ids = this.resolveBranchIds(actor, null, requestedBranchId, role);
    return ids[0] || null;
  }

  static isStaffRole(role) {
    return STAFF_ROLES.includes(role);
  }
}

module.exports = UserRoleService;
