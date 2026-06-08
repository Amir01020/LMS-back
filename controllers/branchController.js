const { Branch, User } = require('../models');
const BranchStatsService = require('../services/branchStatsService');
const { HTTP_STATUS } = require('../utils/constants');
const { sendSuccess, sendError } = require('../utils/response');

class BranchController {
  static async list(req, res) {
    try {
      const branches = await Branch.findAll({
        where: { is_active: true },
        order: [['name', 'ASC']],
        include: [{
          model: User,
          as: 'staff',
          attributes: ['id', 'name', 'role'],
          where: { is_active: true },
          required: false
        }]
      });

      return sendSuccess(res, { branches });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async create(req, res) {
    try {
      const { name, address, phone } = req.body;
      if (!name) {
        return sendError(res, 'Название филиала обязательно', HTTP_STATUS.BAD_REQUEST);
      }

      const branch = await Branch.create({ name, address, phone });
      return sendSuccess(res, { branch }, 'Филиал создан', HTTP_STATUS.CREATED);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async getById(req, res) {
    try {
      const branch = await Branch.findByPk(req.params.id, {
        include: [{
          model: User,
          as: 'staff',
          attributes: ['id', 'name', 'email', 'role', 'salary'],
          where: { is_active: true },
          required: false
        }]
      });

      if (!branch || !branch.is_active) {
        return sendError(res, 'Филиал не найден', HTTP_STATUS.NOT_FOUND);
      }

      return sendSuccess(res, { branch });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async update(req, res) {
    try {
      const branch = await Branch.findByPk(req.params.id);
      if (!branch || !branch.is_active) {
        return sendError(res, 'Филиал не найден', HTTP_STATUS.NOT_FOUND);
      }

      const { name, address, phone } = req.body;
      const updates = {};
      if (name) updates.name = name;
      if (address !== undefined) updates.address = address;
      if (phone !== undefined) updates.phone = phone;

      await branch.update(updates);
      return sendSuccess(res, { branch }, 'Филиал обновлён');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async archive(req, res) {
    try {
      const branch = await Branch.findByPk(req.params.id);
      if (!branch) return sendError(res, 'Филиал не найден', HTTP_STATUS.NOT_FOUND);

      await branch.update({ is_active: false });
      return sendSuccess(res, null, 'Филиал архивирован');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async stats(req, res) {
    try {
      const branch = await Branch.findByPk(req.params.id);
      if (!branch || !branch.is_active) {
        return sendError(res, 'Филиал не найден', HTTP_STATUS.NOT_FOUND);
      }

      const period = req.query.period || 'month';
      if (!['month', 'quarter', 'year'].includes(period)) {
        return sendError(res, 'period должен быть month, quarter или year', HTTP_STATUS.BAD_REQUEST);
      }

      const stats = await BranchStatsService.getBranchStats(branch.id, period);
      return sendSuccess(res, { branch, stats });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async allStats(req, res) {
    try {
      const period = req.query.period || 'month';
      const branchesStats = await BranchStatsService.getAllBranchesStats(period);
      return sendSuccess(res, { branchesStats, period });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async listStudents(req, res) {
    try {
      const { branch_id, search, page = 1, limit = 20 } = req.query;
      const data = await BranchStatsService.listStudents({
        branchId: branch_id ? parseInt(branch_id) : null,
        search,
        page: parseInt(page),
        limit: parseInt(limit)
      });
      return sendSuccess(res, data);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async studentStatsOverview(req, res) {
    try {
      const overview = await BranchStatsService.getStudentOverview();
      return sendSuccess(res, overview);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }
}

module.exports = BranchController;
