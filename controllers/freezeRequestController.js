const { Op } = require('sequelize');
const {
  StudentFreezeRequest, GroupStudent, Group, User, Branch
} = require('../models');
const BranchAccessService = require('../services/branchAccessService');
const {
  USER_ROLES, FREEZE_REQUEST_STATUS, ENROLLMENT_STATUS, HTTP_STATUS
} = require('../utils/constants');
const { sendSuccess, sendError } = require('../utils/response');

class FreezeRequestController {
  static async list(req, res) {
    try {
      const { status, branch_id } = req.query;
      const where = {};

      if (status) where.status = status;

      if (req.user.role === USER_ROLES.STUDENT) {
        where.student_id = req.user.userId;
      } else if (req.user.role === USER_ROLES.MANAGER) {
        const branchIds = req.user.branchIds?.length
          ? req.user.branchIds
          : (req.user.branchId ? [req.user.branchId] : []);
        if (branchIds.length) where.branch_id = { [Op.in]: branchIds };
      } else if (branch_id && req.user.role === USER_ROLES.SUPER_ADMIN) {
        where.branch_id = branch_id;
      }

      const requests = await StudentFreezeRequest.findAll({
        where,
        include: [
          { model: User, as: 'student', attributes: ['id', 'name', 'email', 'avatar_url'] },
          { model: Group, as: 'group', attributes: ['id', 'name'] },
          { model: Branch, as: 'branch', attributes: ['id', 'name'] },
          { model: User, as: 'reviewer', attributes: ['id', 'name'] }
        ],
        order: [['created_at', 'DESC']]
      });

      return sendSuccess(res, { requests });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async create(req, res) {
    try {
      if (req.user.role !== USER_ROLES.STUDENT) {
        return sendError(res, 'Только студент может отправить запрос', HTTP_STATUS.FORBIDDEN);
      }

      const { group_id, reason } = req.body;
      if (!group_id) {
        return sendError(res, 'group_id обязателен', HTTP_STATUS.BAD_REQUEST);
      }

      const enrollment = await GroupStudent.findOne({
        where: { group_id, user_id: req.user.userId, status: ENROLLMENT_STATUS.ACTIVE }
      });
      if (!enrollment) {
        return sendError(res, 'Вы не состоите в этой группе', HTTP_STATUS.BAD_REQUEST);
      }

      const group = await Group.findByPk(group_id);
      if (!group?.branch_id) {
        return sendError(res, 'Группа без филиала', HTTP_STATUS.BAD_REQUEST);
      }

      const pending = await StudentFreezeRequest.findOne({
        where: {
          student_id: req.user.userId,
          group_id,
          status: FREEZE_REQUEST_STATUS.PENDING
        }
      });
      if (pending) {
        return sendError(res, 'Запрос на заморозку уже отправлен', HTTP_STATUS.CONFLICT);
      }

      const request = await StudentFreezeRequest.create({
        student_id: req.user.userId,
        group_id,
        branch_id: group.branch_id,
        reason: reason || null,
        status: FREEZE_REQUEST_STATUS.PENDING
      });

      const full = await StudentFreezeRequest.findByPk(request.id, {
        include: [
          { model: Group, as: 'group', attributes: ['id', 'name'] },
          { model: Branch, as: 'branch', attributes: ['id', 'name'] }
        ]
      });

      return sendSuccess(res, { request: full }, 'Запрос на заморозку отправлен', HTTP_STATUS.CREATED);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async review(req, res) {
    try {
      const { action, manager_comment } = req.body;
      if (!['approve', 'reject'].includes(action)) {
        return sendError(res, 'action: approve или reject', HTTP_STATUS.BAD_REQUEST);
      }

      const request = await StudentFreezeRequest.findByPk(req.params.id);
      if (!request) return sendError(res, 'Запрос не найден', HTTP_STATUS.NOT_FOUND);
      if (request.status !== FREEZE_REQUEST_STATUS.PENDING) {
        return sendError(res, 'Запрос уже обработан', HTTP_STATUS.BAD_REQUEST);
      }

      if (req.user.role === USER_ROLES.MANAGER) {
        const hasBranch = await BranchAccessService.userHasBranch(req.user.userId, request.branch_id);
        if (!hasBranch) return sendError(res, 'Доступ запрещен', HTTP_STATUS.FORBIDDEN);
      } else if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
        return sendError(res, 'Доступ запрещен', HTTP_STATUS.FORBIDDEN);
      }

      if (action === 'approve') {
        await GroupStudent.update(
          { status: ENROLLMENT_STATUS.FROZEN, frozen_at: new Date() },
          { where: { group_id: request.group_id, user_id: request.student_id } }
        );
        await request.update({
          status: FREEZE_REQUEST_STATUS.APPROVED,
          reviewed_by: req.user.userId,
          reviewed_at: new Date(),
          manager_comment: manager_comment || null
        });
      } else {
        await request.update({
          status: FREEZE_REQUEST_STATUS.REJECTED,
          reviewed_by: req.user.userId,
          reviewed_at: new Date(),
          manager_comment: manager_comment || null
        });
      }

      const full = await StudentFreezeRequest.findByPk(request.id, {
        include: [
          { model: User, as: 'student', attributes: ['id', 'name', 'email'] },
          { model: Group, as: 'group', attributes: ['id', 'name'] },
          { model: User, as: 'reviewer', attributes: ['id', 'name'] }
        ]
      });

      return sendSuccess(res, { request: full }, action === 'approve' ? 'Студент заморожен' : 'Запрос отклонён');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }
}

module.exports = FreezeRequestController;
