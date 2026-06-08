const { UserBranch, User, Group } = require('../models');
const { USER_ROLES } = require('../utils/constants');

class BranchAccessService {
  static async getUserBranchIds(userId) {
    const links = await UserBranch.findAll({ where: { user_id: userId } });
    if (links.length) {
      return links.map((l) => l.branch_id);
    }

    const user = await User.findByPk(userId, { attributes: ['branch_id'] });
    return user?.branch_id ? [user.branch_id] : [];
  }

  static async syncUserBranches(userId, branchIds = []) {
    const uniqueIds = [...new Set(branchIds.filter(Boolean))];
    await UserBranch.destroy({ where: { user_id: userId } });

    if (uniqueIds.length) {
      await UserBranch.bulkCreate(uniqueIds.map((branch_id) => ({ user_id: userId, branch_id })));
      await User.update({ branch_id: uniqueIds[0] }, { where: { id: userId } });
    } else {
      await User.update({ branch_id: null }, { where: { id: userId } });
    }

    return uniqueIds;
  }

  static async userHasBranch(userId, branchId) {
    if (!branchId) return false;
    const branchIds = await this.getUserBranchIds(userId);
    return branchIds.includes(parseInt(branchId));
  }

  static async getBranchStaffIds(branchId, roles = [USER_ROLES.MANAGER, USER_ROLES.SUPPORT]) {
    const links = await UserBranch.findAll({ where: { branch_id: branchId } });
    const userIdsFromLinks = links.map((l) => l.user_id);

    const legacyUsers = await User.findAll({
      where: { branch_id: branchId, role: roles, is_active: true },
      attributes: ['id']
    });

    const allIds = [...new Set([...userIdsFromLinks, ...legacyUsers.map((u) => u.id)])];
    if (!allIds.length) return [];

    const staff = await User.findAll({
      where: { id: allIds, role: roles, is_active: true },
      attributes: ['id']
    });

    return staff.map((s) => s.id);
  }

  static async getStudentBranchId(studentId) {
    const { GroupStudent, Group } = require('../models');
    const link = await GroupStudent.findOne({ where: { user_id: studentId } });
    if (!link) return null;
    const group = await Group.findByPk(link.group_id, { attributes: ['branch_id'] });
    return group?.branch_id || null;
  }
}

module.exports = BranchAccessService;
