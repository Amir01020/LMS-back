const { Op } = require('sequelize');
const {
  User, Group, GroupStudent, BranchBudget, BranchIncome, SalaryPayment
} = require('../models');
const { USER_ROLES, ENROLLMENT_STATUS } = require('../utils/constants');
const { getPeriodStartDate, getCurrentYearMonth } = require('../utils/dateHelpers');

class BranchStatsService {
  static async getBranchGroupIds(branchId) {
    const groups = await Group.findAll({
      where: { branch_id: branchId },
      attributes: ['id']
    });
    return groups.map((g) => g.id);
  }

  static async countNewStudents(branchId, sinceDate) {
    const groupIds = await this.getBranchGroupIds(branchId);
    if (!groupIds.length) return 0;

    const where = { group_id: groupIds };
    if (sinceDate) where.joined_at = { [Op.gte]: sinceDate };

    const rows = await GroupStudent.findAll({
      where,
      attributes: ['user_id'],
      group: ['user_id']
    });

    return rows.length;
  }

  static async countActiveStudents(branchId) {
    const groupIds = await this.getBranchGroupIds(branchId);
    if (!groupIds.length) return 0;

    const rows = await GroupStudent.findAll({
      where: { group_id: groupIds },
      attributes: ['user_id'],
      group: ['user_id']
    });

    return rows.length;
  }

  static async sumIncome(branchId, sinceDate) {
    const where = { branch_id: branchId };
    if (sinceDate) {
      where.income_date = { [Op.gte]: sinceDate };
    }

    const total = await BranchIncome.sum('amount', { where });
    return parseFloat(total) || 0;
  }

  static async getCurrentBudget(branchId) {
    const { year, month } = getCurrentYearMonth();
    const budget = await BranchBudget.findOne({
      where: { branch_id: branchId, year, month }
    });

    return budget ? parseFloat(budget.allocated_amount) : 0;
  }

  static async getStaffCounts(branchId) {
    const roles = [USER_ROLES.MANAGER, USER_ROLES.MENTOR, USER_ROLES.SUPPORT];
    const counts = {};

    await Promise.all(roles.map(async (role) => {
      counts[role] = await User.count({
        where: { branch_id: branchId, role, is_active: true }
      });
    }));

    return counts;
  }

  static async countFrozenStudents(branchId, sinceDate) {
    const groupIds = await this.getBranchGroupIds(branchId);
    if (!groupIds.length) return 0;
    const where = { group_id: groupIds, status: ENROLLMENT_STATUS.FROZEN };
    if (sinceDate) where.frozen_at = { [Op.gte]: sinceDate };
    return GroupStudent.count({ where });
  }

  static async countLostStudents(branchId, sinceDate) {
    const groupIds = await this.getBranchGroupIds(branchId);
    if (!groupIds.length) return 0;
    const where = { group_id: groupIds, status: ENROLLMENT_STATUS.LEFT };
    if (sinceDate) where.left_at = { [Op.gte]: sinceDate };
    return GroupStudent.count({ where });
  }

  static async getBranchStats(branchId, period = 'month') {
    const sinceDate = getPeriodStartDate(period);
    const { year, month } = getCurrentYearMonth();

    const [
      newStudents,
      activeStudents,
      frozenStudents,
      lostStudents,
      income,
      currentBudget,
      staffCounts
    ] = await Promise.all([
      this.countNewStudents(branchId, sinceDate),
      this.countActiveStudents(branchId),
      this.countFrozenStudents(branchId, sinceDate),
      this.countLostStudents(branchId, sinceDate),
      this.sumIncome(branchId, sinceDate),
      this.getCurrentBudget(branchId),
      this.getStaffCounts(branchId)
    ]);

    const salaryPayments = await SalaryPayment.findAll({
      where: { branch_id: branchId, year, month },
      include: [{ model: User, as: 'employee', attributes: ['id', 'name', 'role'] }]
    });

    const salarySummary = {
      total: salaryPayments.length,
      paid: salaryPayments.filter((p) => p.is_paid).length,
      unpaid: salaryPayments.filter((p) => !p.is_paid).length,
      totalAmount: salaryPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0),
      paidAmount: salaryPayments.filter((p) => p.is_paid).reduce((sum, p) => sum + parseFloat(p.amount), 0)
    };

    return {
      period,
      sinceDate,
      newStudents,
      activeStudents,
      frozenStudents,
      lostStudents,
      income,
      currentBudget,
      staffCounts,
      salarySummary
    };
  }

  static async getAllBranchesStats(period = 'month') {
    const { Branch } = require('../models');
    const branches = await Branch.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });

    const stats = await Promise.all(branches.map(async (branch) => ({
      branch: branch.toJSON(),
      stats: await this.getBranchStats(branch.id, period)
    })));

    return stats;
  }

  static async listStudents({ branchId, branchIds, search, page = 1, limit = 20 }) {
    const { Op } = require('sequelize');
    const { User, Group, Direction, Branch } = require('../models');

    const resolvedBranchIds = branchIds?.length
      ? branchIds
      : (branchId ? [branchId] : []);

    const where = { role: USER_ROLES.STUDENT, is_active: true };
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const groupInclude = {
      model: Group,
      as: 'studentGroups',
      required: resolvedBranchIds.length > 0,
      attributes: ['id', 'name', 'branch_id'],
      include: [
        { model: Branch, as: 'branch', attributes: ['id', 'name'] },
        { model: Direction, as: 'direction', attributes: ['id', 'name'] }
      ]
    };

    if (resolvedBranchIds.length) {
      groupInclude.where = { branch_id: { [Op.in]: resolvedBranchIds } };
    }

    const offset = (page - 1) * limit;
    const result = await User.findAndCountAll({
      where,
      include: [groupInclude],
      distinct: true,
      order: [['name', 'ASC']],
      limit,
      offset
    });

    return {
      students: result.rows,
      pagination: {
        total: result.count,
        page,
        limit,
        pages: Math.ceil(result.count / limit)
      }
    };
  }

  static async getStudentOverview() {
    const { Branch } = require('../models');
    const branches = await Branch.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });
    const totalStudents = await this.countActiveStudents(null);

    const byBranch = await Promise.all(branches.map(async (branch) => ({
      branch: branch.toJSON(),
      studentsCount: await this.countActiveStudents(branch.id)
    })));

    const withoutBranch = await this.countStudentsWithoutBranch();

    return { totalStudents, withoutBranch, byBranch };
  }

  static async countStudentsWithoutBranch() {
    const { User, Group } = require('../models');
    const students = await User.findAll({
      where: { role: USER_ROLES.STUDENT, is_active: true },
      include: [{
        model: Group,
        as: 'studentGroups',
        required: false,
        attributes: ['id', 'branch_id']
      }]
    });

    return students.filter((s) => !s.studentGroups?.length || s.studentGroups.every((g) => !g.branch_id)).length;
  }
}

module.exports = BranchStatsService;
