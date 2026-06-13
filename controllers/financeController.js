const { Op } = require('sequelize');
const {
  Branch, BranchBudget, BranchIncome, SalaryPayment, User, UserBranch
} = require('../models');
const BranchStatsService = require('../services/branchStatsService');
const SalaryService = require('../services/salaryService');
const UserRoleService = require('../services/userRoleService');
const { USER_ROLES, STAFF_ROLES, HTTP_STATUS } = require('../utils/constants');
const { getCurrentYearMonth } = require('../utils/dateHelpers');
const { sendSuccess, sendError } = require('../utils/response');

class FinanceController {
  static async setBudget(req, res) {
    try {
      const branch = await Branch.findByPk(req.params.branchId);
      if (!branch || !branch.is_active) {
        return sendError(res, 'Филиал не найден', HTTP_STATUS.NOT_FOUND);
      }

      const { year, month, allocated_amount, notes } = req.body;
      const current = getCurrentYearMonth();
      const targetYear = year || current.year;
      const targetMonth = month || current.month;

      if (!allocated_amount && allocated_amount !== 0) {
        return sendError(res, 'allocated_amount обязателен', HTTP_STATUS.BAD_REQUEST);
      }

      const [budget] = await BranchBudget.findOrCreate({
        where: { branch_id: branch.id, year: targetYear, month: targetMonth },
        defaults: {
          allocated_amount,
          notes: notes || null,
          created_by: req.user.userId
        }
      });

      if (budget) {
        await budget.update({
          allocated_amount,
          notes: notes !== undefined ? notes : budget.notes,
          created_by: req.user.userId
        });
      }

      return sendSuccess(res, { budget }, 'Бюджет филиала сохранён');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async listBudgets(req, res) {
    try {
      const { year, month } = req.query;
      const where = { branch_id: req.params.branchId };
      if (year) where.year = parseInt(year);
      if (month) where.month = parseInt(month);

      const budgets = await BranchBudget.findAll({
        where,
        order: [['year', 'DESC'], ['month', 'DESC']]
      });

      return sendSuccess(res, { budgets });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async addIncome(req, res) {
    try {
      const branch = await Branch.findByPk(req.params.branchId);
      if (!branch || !branch.is_active) {
        return sendError(res, 'Филиал не найден', HTTP_STATUS.NOT_FOUND);
      }

      const { amount, income_date, description, student_id } = req.body;
      if (!amount || parseFloat(amount) <= 0) {
        return sendError(res, 'Сумма дохода должна быть больше нуля', HTTP_STATUS.BAD_REQUEST);
      }

      const income = await BranchIncome.create({
        branch_id: branch.id,
        amount,
        income_date: income_date || new Date(),
        description: description || null,
        student_id: student_id || null,
        created_by: req.user.userId
      });

      return sendSuccess(res, { income }, 'Доход записан', HTTP_STATUS.CREATED);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async listIncome(req, res) {
    try {
      const { from, to } = req.query;
      const where = { branch_id: req.params.branchId };

      if (from || to) {
        where.income_date = {};
        if (from) where.income_date[Op.gte] = from;
        if (to) where.income_date[Op.lte] = to;
      }

      const incomes = await BranchIncome.findAll({
        where,
        include: [
          { model: User, as: 'student', attributes: ['id', 'name', 'email'] },
          { model: User, as: 'recorder', attributes: ['id', 'name'] }
        ],
        order: [['income_date', 'DESC'], ['id', 'DESC']]
      });

      const total = incomes.reduce((sum, item) => sum + parseFloat(item.amount), 0);

      return sendSuccess(res, { incomes, total });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static parseListParam(value) {
    if (!value) return [];
    const raw = Array.isArray(value) ? value : String(value).split(',');
    return [...new Set(raw.map((item) => String(item).trim()).filter(Boolean))];
  }

  static async listEmployees(req, res) {
    try {
      const { branch_id, role, salary_min, salary_max } = req.query;
      const branchIds = FinanceController.parseListParam(branch_id).map(Number).filter(Number.isFinite);
      const roles = FinanceController.parseListParam(role);
      const where = { is_active: true };

      if (roles.length) {
        where.role = { [Op.in]: roles };
      } else {
        where.role = STAFF_ROLES.filter((r) => r !== USER_ROLES.SUPER_ADMIN);
      }

      if (branchIds.length) {
        const links = await UserBranch.findAll({ where: { branch_id: { [Op.in]: branchIds } } });
        const userIds = [...new Set(links.map((l) => l.user_id))];
        const branchConditions = [{ branch_id: { [Op.in]: branchIds } }];
        if (userIds.length) branchConditions.push({ id: { [Op.in]: userIds } });
        where[Op.and] = [...(where[Op.and] || []), { [Op.or]: branchConditions }];
      }

      if (salary_min !== undefined && salary_min !== '') {
        where.salary = { ...(where.salary || {}), [Op.gte]: parseFloat(salary_min) };
      }
      if (salary_max !== undefined && salary_max !== '') {
        where.salary = { ...(where.salary || {}), [Op.lte]: parseFloat(salary_max) };
      }

      const employees = await User.findAll({
        where,
        attributes: ['id', 'name', 'email', 'phone', 'role', 'branch_id', 'salary', 'avatar_url'],
        include: [
          { model: Branch, as: 'branch', attributes: ['id', 'name'] },
          { model: Branch, as: 'branches', attributes: ['id', 'name'], through: { attributes: [] } }
        ],
        order: [['name', 'ASC']]
      });

      return sendSuccess(res, { employees });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async setEmployeeSalary(req, res) {
    try {
      const employee = await User.findByPk(req.params.userId);
      if (!employee || !UserRoleService.isStaffRole(employee.role) || employee.role === USER_ROLES.SUPER_ADMIN) {
        return sendError(res, 'Сотрудник не найден', HTTP_STATUS.NOT_FOUND);
      }

      const { salary, branch_id, branch_ids } = req.body;
      const updates = {};
      const BranchAccessService = require('../services/branchAccessService');

      if (salary !== undefined) {
        if (parseFloat(salary) < 0) {
          return sendError(res, 'Зарплата не может быть отрицательной', HTTP_STATUS.BAD_REQUEST);
        }
        updates.salary = salary;
      }

      if (branch_ids !== undefined && UserRoleService.requiresBranch(employee.role)) {
        await BranchAccessService.syncUserBranches(employee.id, branch_ids);
      } else if (branch_id !== undefined && UserRoleService.requiresBranch(employee.role)) {
        const branch = await Branch.findByPk(branch_id);
        if (!branch || !branch.is_active) {
          return sendError(res, 'Филиал не найден', HTTP_STATUS.NOT_FOUND);
        }
        await BranchAccessService.syncUserBranches(employee.id, [branch_id]);
      }

      if (Object.keys(updates).length) {
        await employee.update(updates);
      }

      const refreshed = await User.findByPk(employee.id, {
        attributes: ['id', 'name', 'email', 'phone', 'role', 'branch_id', 'salary', 'avatar_url'],
        include: [
          { model: Branch, as: 'branch', attributes: ['id', 'name'] },
          { model: Branch, as: 'branches', attributes: ['id', 'name'], through: { attributes: [] } }
        ]
      });

      return sendSuccess(res, { employee: refreshed }, 'Данные сотрудника обновлены');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async listSalaryPayments(req, res) {
    try {
      const { year, month, branch_id, is_paid } = req.query;
      const where = {};

      if (year) where.year = parseInt(year);
      if (month) where.month = parseInt(month);
      if (branch_id) where.branch_id = parseInt(branch_id);
      if (is_paid !== undefined) where.is_paid = is_paid === 'true';

      const payments = await SalaryPayment.findAll({
        where,
        include: [
          {
            model: User,
            as: 'employee',
            attributes: ['id', 'name', 'email', 'role']
          },
          { model: Branch, as: 'branch', attributes: ['id', 'name'] },
          { model: User, as: 'payer', attributes: ['id', 'name'] }
        ],
        order: [['year', 'DESC'], ['month', 'DESC'], ['id', 'DESC']]
      });

      const summary = {
        total: payments.length,
        paid: payments.filter((p) => p.is_paid).length,
        unpaid: payments.filter((p) => !p.is_paid).length,
        totalAmount: payments.reduce((sum, p) => sum + parseFloat(p.amount), 0),
        paidAmount: payments.filter((p) => p.is_paid).reduce((sum, p) => sum + parseFloat(p.amount), 0)
      };

      return sendSuccess(res, { payments, summary });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async generateSalaryPayments(req, res) {
    try {
      const { year, month } = req.body;
      const current = getCurrentYearMonth();
      const targetYear = year || current.year;
      const targetMonth = month || current.month;

      const payments = await SalaryService.generateMonthlyPayments(targetYear, targetMonth);
      return sendSuccess(res, { payments, count: payments.length }, 'Ведомость зарплат сформирована');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async updateSalaryPayment(req, res) {
    try {
      const payment = await SalaryPayment.findByPk(req.params.id);
      if (!payment) {
        return sendError(res, 'Запись о выплате не найдена', HTTP_STATUS.NOT_FOUND);
      }

      const { is_paid, notes } = req.body;
      const updates = {};

      if (is_paid !== undefined) {
        updates.is_paid = is_paid;
        updates.paid_at = is_paid ? new Date() : null;
        updates.paid_by = is_paid ? req.user.userId : null;
      }

      if (notes !== undefined) updates.notes = notes;

      await payment.update(updates);

      const updated = await SalaryPayment.findByPk(payment.id, {
        include: [
          { model: User, as: 'employee', attributes: ['id', 'name', 'role'] },
          { model: Branch, as: 'branch', attributes: ['id', 'name'] }
        ]
      });

      return sendSuccess(res, { payment: updated }, 'Статус выплаты обновлён');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async branchFinanceOverview(req, res) {
    try {
      const branchId = parseInt(req.params.branchId);
      const period = req.query.period || 'month';

      const [stats, budgets] = await Promise.all([
        BranchStatsService.getBranchStats(branchId, period),
        BranchBudget.findAll({
          where: { branch_id: branchId },
          order: [['year', 'DESC'], ['month', 'DESC']],
          limit: 12
        })
      ]);

      return sendSuccess(res, { stats, budgets });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }
}

module.exports = FinanceController;
