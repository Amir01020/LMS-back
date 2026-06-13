const { Op } = require('sequelize');
const { sequelize } = require('../models');
const {
  User, Group, GroupStudent, Lesson, Homework, HomeworkSubmission, Order
} = require('../models');
const StatsService = require('../services/statsService');
const BranchStatsService = require('../services/branchStatsService');
const UserRoleService = require('../services/userRoleService');
const GroupAccessService = require('../services/groupAccessService');
const { USER_ROLES, HTTP_STATUS } = require('../utils/constants');
const { sendSuccess, sendError } = require('../utils/response');

const USER_ATTRS = ['id', 'name', 'email', 'role', 'avatar_url'];

class StatsController {
  static async studentStats(req, res) {
    try {
      const { group_id } = req.query;
      let studentIds = [];

      if (req.user.role === USER_ROLES.STUDENT) {
        studentIds = [req.user.userId];
      } else if (group_id) {
        const canAccess = await GroupAccessService.canAccessGroup(req.user, group_id);
        if (!canAccess) return sendError(res, 'Доступ запрещен', HTTP_STATUS.FORBIDDEN);
        const links = await GroupStudent.findAll({ where: { group_id } });
        studentIds = links.map((l) => l.user_id);
      } else if (req.user.role === USER_ROLES.MENTOR) {
        const groupIds = await GroupAccessService.getMentorGroupIds(req.user.userId);
        const links = await GroupStudent.findAll({ where: { group_id: groupIds } });
        studentIds = links.map((l) => l.user_id);
      } else {
        const students = await User.findAll({ where: { role: USER_ROLES.STUDENT, is_active: true } });
        studentIds = students.map((s) => s.id);
      }

      const stats = await Promise.all(
        studentIds.map((id) => StatsService.getStudentStats(id, group_id ? Number(group_id) : null))
      );

      const result = stats
        .filter(Boolean)
        .sort((a, b) => b.performanceScore - a.performanceScore)
        .map((s, i) => ({ ...s, rank: i + 1 }));

      return sendSuccess(res, { stats: result });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async mentorStats(req, res) {
    try {
      const { group_id } = req.query;
      const where = { role: USER_ROLES.MENTOR, is_active: true };

      if (req.user.role === USER_ROLES.MENTOR) {
        where.id = req.user.userId;
      } else if (group_id) {
        const canAccess = await GroupAccessService.canAccessGroup(req.user, group_id);
        if (!canAccess) return sendError(res, 'Доступ запрещен', HTTP_STATUS.FORBIDDEN);
        const group = await Group.findByPk(group_id, {
          include: [{ model: User, as: 'mentors', attributes: ['id'] }]
        });
        const mentorIds = group?.mentors?.map((m) => m.id) || [];
        where.id = mentorIds.length ? { [Op.in]: mentorIds } : -1;
      }

      const mentors = await User.findAll({ where, attributes: USER_ATTRS });

      const stats = await Promise.all(
        mentors.map((m) => StatsService.getMentorStats(m.id, group_id ? Number(group_id) : null))
      );

      const result = stats
        .filter(Boolean)
        .sort((a, b) => b.averageRating - a.averageRating);

      return sendSuccess(res, { stats: result });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async groupStats(req, res) {
    try {
      const { id: groupId } = req.params;
      const canAccess = await GroupAccessService.canAccessGroup(req.user, groupId);
      if (!canAccess) return sendError(res, 'Доступ запрещен', HTTP_STATUS.FORBIDDEN);

      const stats = await StatsService.getGroupStats(groupId);
      if (!stats) return sendError(res, 'Группа не найдена', HTTP_STATUS.NOT_FOUND);

      return sendSuccess(res, stats);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async memberStats(req, res) {
    try {
      const { id: groupId, userId } = req.params;
      const canAccess = await GroupAccessService.canAccessGroup(req.user, groupId);
      if (!canAccess) return sendError(res, 'Доступ запрещен', HTTP_STATUS.FORBIDDEN);

      if (req.user.role === USER_ROLES.STUDENT && Number(userId) !== req.user.userId) {
        return sendError(res, 'Доступ запрещен', HTTP_STATUS.FORBIDDEN);
      }

      const stats = await StatsService.getMemberStats(groupId, Number(userId));
      if (!stats) return sendError(res, 'Участник не найден в группе', HTTP_STATUS.NOT_FOUND);

      return sendSuccess(res, { stats });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async staffRankings(req, res) {
    try {
      const { branch_id } = req.query;
      let branchId = branch_id ? Number(branch_id) : null;

      if (req.user.role === USER_ROLES.MENTOR || req.user.role === USER_ROLES.SUPPORT) {
        branchId = req.user.branchId || null;
      } else if (req.user.role === USER_ROLES.MANAGER && req.user.branchId) {
        branchId = req.user.branchId;
      }

      const stats = await StatsService.getStaffRankings(branchId);
      return sendSuccess(res, { stats });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async studentRankings(req, res) {
    try {
      const userId = req.user.role === USER_ROLES.STUDENT
        ? req.user.userId
        : Number(req.query.user_id);

      if (!userId) {
        return sendError(res, 'user_id обязателен', HTTP_STATUS.BAD_REQUEST);
      }

      if (req.user.role === USER_ROLES.STUDENT && userId !== req.user.userId) {
        return sendError(res, 'Доступ запрещен', HTTP_STATUS.FORBIDDEN);
      }

      const data = await StatsService.getStudentRankings(userId);
      if (!data) return sendError(res, 'Студент не найден', HTTP_STATUS.NOT_FOUND);

      return sendSuccess(res, data);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async getBranchOverviewCounts(branchId) {
    const groupIds = await BranchStatsService.getBranchGroupIds(branchId);
    if (!groupIds.length) {
      return {
        activeStudents: 0,
        activeGroups: 0,
        lessonsCount: 0,
        homeworksCount: 0,
        submissionsCount: 0,
        shopPointsSpent: 0
      };
    }

    const studentRows = await GroupStudent.findAll({
      where: { group_id: groupIds },
      attributes: ['user_id'],
      group: ['user_id']
    });
    const studentIds = studentRows.map((row) => row.user_id);

    const [
      activeStudents,
      activeGroups,
      lessonsCount,
      homeworksCount,
      submissionsCount,
      ordersSpent
    ] = await Promise.all([
      studentIds.length
        ? User.count({ where: { id: studentIds, role: USER_ROLES.STUDENT, is_active: true } })
        : 0,
      Group.count({ where: { id: groupIds, status: 'active' } }),
      Lesson.count({ where: { group_id: groupIds } }),
      Homework.count({ where: { group_id: groupIds, status: 'published' } }),
      studentIds.length
        ? HomeworkSubmission.count({ where: { student_id: studentIds } })
        : 0,
      studentIds.length
        ? Order.sum('total_price', { where: { student_id: studentIds } })
        : 0
    ]);

    return {
      activeStudents,
      activeGroups,
      lessonsCount,
      homeworksCount,
      submissionsCount,
      shopPointsSpent: parseFloat(ordersSpent) || 0
    };
  }

  static async overview(req, res) {
    try {
      let stats;

      if (UserRoleService.isManager(req.user) && req.user.branchId) {
        stats = await StatsController.getBranchOverviewCounts(req.user.branchId);
      } else {
        const [
          activeStudents,
          activeGroups,
          lessonsCount,
          homeworksCount,
          submissionsCount,
          ordersSpent
        ] = await Promise.all([
          User.count({ where: { role: USER_ROLES.STUDENT, is_active: true } }),
          Group.count({ where: { status: 'active' } }),
          Lesson.count(),
          Homework.count({ where: { status: 'published' } }),
          HomeworkSubmission.count(),
          Order.sum('total_price')
        ]);

        stats = {
          activeStudents,
          activeGroups,
          lessonsCount,
          homeworksCount,
          submissionsCount,
          shopPointsSpent: parseFloat(ordersSpent) || 0
        };
      }

      return sendSuccess(res, stats);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async branchesComparison(req, res) {
    try {
      const { period = 'month' } = req.query;
      const branchesStats = await BranchStatsService.getAllBranchesStats(period);

      return sendSuccess(res, {
        period,
        branches: branchesStats.map(({ branch, stats }) => ({
          branchId: branch.id,
          branchName: branch.name,
          newStudents: stats.newStudents,
          lostStudents: stats.lostStudents,
          frozenStudents: stats.frozenStudents
        }))
      });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }
}

module.exports = StatsController;
