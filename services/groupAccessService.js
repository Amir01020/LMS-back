const { GroupMentor, GroupStudent, Group, Lesson } = require('../models');
const { Op } = require('sequelize');
const BranchAccessService = require('./branchAccessService');
const { USER_ROLES } = require('../utils/constants');

class GroupAccessService {
  static async isMentorOfGroup(userId, groupId) {
    const link = await GroupMentor.findOne({
      where: { user_id: userId, group_id: groupId }
    });
    return !!link;
  }

  static async isStudentOfGroup(userId, groupId) {
    const link = await GroupStudent.findOne({
      where: { user_id: userId, group_id: groupId }
    });
    return !!link;
  }

  static async getGroupBranchId(groupId) {
    const group = await Group.findByPk(groupId, { attributes: ['branch_id'] });
    return group?.branch_id || null;
  }

  static async canAccessGroup(user, groupId) {
    if (user.role === USER_ROLES.SUPER_ADMIN) {
      return true;
    }

    if (user.role === USER_ROLES.MANAGER || user.role === USER_ROLES.SUPPORT) {
      const branchIds = user.branchIds?.length
        ? user.branchIds
        : (user.branchId ? [user.branchId] : []);
      if (!branchIds.length) return true;
      const branchId = await this.getGroupBranchId(groupId);
      return branchIds.includes(branchId);
    }

    if (user.role === USER_ROLES.MENTOR) {
      return this.isMentorOfGroup(user.userId, groupId);
    }
    if (user.role === USER_ROLES.STUDENT) {
      return this.isStudentOfGroup(user.userId, groupId);
    }
    return false;
  }

  static async canAccessLesson(user, lessonId) {
    const lesson = await Lesson.findByPk(lessonId);
    if (!lesson) return false;
    return this.canAccessGroup(user, lesson.group_id);
  }

  static async getMentorGroupIds(userId) {
    const links = await GroupMentor.findAll({ where: { user_id: userId } });
    return links.map((l) => l.group_id);
  }

  static async getStudentGroupIds(userId) {
    const links = await GroupStudent.findAll({ where: { user_id: userId } });
    return links.map((l) => l.group_id);
  }

  static async getAccessibleGroupFilter(user) {
    if (user.role === USER_ROLES.SUPER_ADMIN) {
      return {};
    }
    if (user.role === USER_ROLES.MANAGER || user.role === USER_ROLES.SUPPORT) {
      const branchIds = user.branchIds?.length
        ? user.branchIds
        : (user.branchId ? [user.branchId] : []);
      if (!branchIds.length) return {};
      return { branch_id: { [Op.in]: branchIds } };
    }
    if (user.role === USER_ROLES.MENTOR) {
      const ids = await this.getMentorGroupIds(user.userId);
      return { id: ids };
    }
    if (user.role === USER_ROLES.STUDENT) {
      const ids = await this.getStudentGroupIds(user.userId);
      return { id: ids };
    }
    return { id: -1 };
  }
}

module.exports = GroupAccessService;
