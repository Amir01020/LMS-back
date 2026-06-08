const { Op } = require('sequelize');
const {
  Group, Direction, User, GroupStudent, GroupMentor
} = require('../models');
const GroupAccessService = require('../services/groupAccessService');
const { USER_ROLES, HTTP_STATUS } = require('../utils/constants');
const { sendSuccess, sendError } = require('../utils/response');

class GroupController {
  static async list(req, res) {
    try {
      const { status, direction_id, search, branch_id } = req.query;
      const where = {};

      if (status) where.status = status;
      if (direction_id) where.direction_id = direction_id;
      if (search) where.name = { [Op.iLike]: `%${search}%` };

      const accessFilter = await GroupAccessService.getAccessibleGroupFilter(req.user);
      if (accessFilter.id !== undefined) {
        where.id = accessFilter.id;
      } else if (accessFilter.branch_id) {
        where.branch_id = accessFilter.branch_id;
      }

      if (branch_id && req.user.role === USER_ROLES.SUPER_ADMIN) {
        where.branch_id = branch_id;
      }

      const groups = await Group.findAll({
        where,
        include: [
          { model: Direction, as: 'direction' },
          { model: Branch, as: 'branch', attributes: ['id', 'name'] },
          { model: User, as: 'mentors', attributes: ['id', 'name', 'email', 'avatar_url'] },
          { model: User, as: 'students', attributes: ['id', 'name', 'email', 'avatar_url'] }
        ],
        order: [['name', 'ASC']]
      });

      return sendSuccess(res, { groups });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async syncMentor(groupId, mentor_id, mentor_ids) {
    if (mentor_id === undefined && mentor_ids === undefined) return;

    const mentorId = mentor_id ?? mentor_ids?.[0] ?? null;
    await GroupMentor.destroy({ where: { group_id: groupId } });
    if (mentorId) {
      await GroupMentor.create({ group_id: groupId, user_id: mentorId });
    }
  }

  static async create(req, res) {
    try {
      const { name, direction_id, status, start_date, end_date, mentor_id, mentor_ids } = req.body;
      if (!name || !direction_id) {
        return sendError(res, 'Название и направление обязательны', HTTP_STATUS.BAD_REQUEST);
      }

      const branchIds = req.user.branchIds?.length
        ? req.user.branchIds
        : (req.user.branchId ? [req.user.branchId] : []);
      const branch_id = branchIds[0] || null;

      const group = await Group.create({
        name, direction_id, status, start_date, end_date, branch_id
      });

      await GroupController.syncMentor(group.id, mentor_id, mentor_ids);

      const full = await Group.findByPk(group.id, {
        include: [
          { model: Direction, as: 'direction' },
          { model: User, as: 'mentors' },
          { model: User, as: 'students' }
        ]
      });

      return sendSuccess(res, { group: full }, 'Группа создана', HTTP_STATUS.CREATED);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async getById(req, res) {
    try {
      const canAccess = await GroupAccessService.canAccessGroup(req.user, req.params.id);
      if (!canAccess) return sendError(res, 'Доступ запрещен', HTTP_STATUS.FORBIDDEN);

      const group = await Group.findByPk(req.params.id, {
        include: [
          { model: Direction, as: 'direction' },
          { model: User, as: 'mentors' },
          { model: User, as: 'students' }
        ]
      });

      if (!group) return sendError(res, 'Группа не найдена', HTTP_STATUS.NOT_FOUND);
      return sendSuccess(res, { group });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async update(req, res) {
    try {
      const group = await Group.findByPk(req.params.id);
      if (!group) return sendError(res, 'Группа не найдена', HTTP_STATUS.NOT_FOUND);

      const { mentor_id, mentor_ids, student_ids, ...groupData } = req.body;
      await group.update(groupData);

      await GroupController.syncMentor(group.id, mentor_id, mentor_ids);

      const full = await Group.findByPk(group.id, {
        include: [
          { model: Direction, as: 'direction' },
          { model: User, as: 'mentors' },
          { model: User, as: 'students' }
        ]
      });

      return sendSuccess(res, { group: full }, 'Группа обновлена');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async remove(req, res) {
    try {
      const group = await Group.findByPk(req.params.id);
      if (!group) return sendError(res, 'Группа не найдена', HTTP_STATUS.NOT_FOUND);
      await group.destroy();
      return sendSuccess(res, null, 'Группа удалена');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async getStudents(req, res) {
    try {
      const canAccess = await GroupAccessService.canAccessGroup(req.user, req.params.id);
      if (!canAccess) return sendError(res, 'Доступ запрещен', HTTP_STATUS.FORBIDDEN);

      const group = await Group.findByPk(req.params.id, {
        include: [{ model: User, as: 'students' }]
      });
      if (!group) return sendError(res, 'Группа не найдена', HTTP_STATUS.NOT_FOUND);

      return sendSuccess(res, { students: group.students });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async addStudent(req, res) {
    try {
      const { id: groupId, userId } = req.params;
      const [link] = await GroupStudent.findOrCreate({
        where: { group_id: groupId, user_id: userId },
        defaults: { joined_at: new Date() }
      });
      return sendSuccess(res, { link }, 'Студент добавлен в группу', HTTP_STATUS.CREATED);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async removeStudent(req, res) {
    try {
      const { id: groupId, userId } = req.params;
      await GroupStudent.destroy({ where: { group_id: groupId, user_id: userId } });
      return sendSuccess(res, null, 'Студент удален из группы');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async transferStudent(req, res) {
    try {
      const { student_id, from_group_id, to_group_id } = req.body;
      if (!student_id || !from_group_id || !to_group_id) {
        return sendError(res, 'student_id, from_group_id, to_group_id обязательны', HTTP_STATUS.BAD_REQUEST);
      }

      await GroupStudent.destroy({ where: { group_id: from_group_id, user_id: student_id } });
      await GroupStudent.findOrCreate({
        where: { group_id: to_group_id, user_id: student_id },
        defaults: { joined_at: new Date() }
      });

      return sendSuccess(res, null, 'Студент переведен');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }
}

module.exports = GroupController;
