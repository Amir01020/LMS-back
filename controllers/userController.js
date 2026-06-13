const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const AuthService = require('../services/authService');
const { buildAvatarUrl, avatarFilenameFromUrl } = require('../utils/avatarUrl');
const { AVATAR_DIR } = require('../middleware/uploadAvatar');
const PointsService = require('../services/pointsService');
const UserRoleService = require('../services/userRoleService');
const {
  User, Group, GroupStudent, Direction, Branch
} = require('../models');
const { USER_ROLES, HTTP_STATUS } = require('../utils/constants');
const { sendSuccess, sendError } = require('../utils/response');

class UserController {
  static parseIdList(value) {
    if (!value) return [];
    const raw = Array.isArray(value) ? value : String(value).split(',');
    return [...new Set(raw.map((id) => parseInt(id, 10)).filter((id) => Number.isFinite(id)))];
  }

  static buildStudentGroupsInclude(req, { groupIds, mentorIds, directionIds }) {
    const groupWhere = {};

    if (UserRoleService.isManager(req.user) && req.user.branchId) {
      groupWhere.branch_id = req.user.branchId;
    }
    if (groupIds.length) groupWhere.id = { [Op.in]: groupIds };
    if (directionIds.length) groupWhere.direction_id = { [Op.in]: directionIds };

    const nestedIncludes = [
      { model: Direction, as: 'direction', attributes: ['id', 'name'] },
      { model: Branch, as: 'branch', attributes: ['id', 'name'] }
    ];

    nestedIncludes.push({
      model: User,
      as: 'mentors',
      where: mentorIds.length ? { id: { [Op.in]: mentorIds } } : undefined,
      required: mentorIds.length > 0,
      attributes: ['id', 'name']
    });

    const isManagerStudentScope = UserRoleService.isManager(req.user) && req.user.branchId;
    const hasFilter = groupIds.length || mentorIds.length || directionIds.length;

    return {
      model: Group,
      as: 'studentGroups',
      where: Object.keys(groupWhere).length ? groupWhere : undefined,
      required: isManagerStudentScope || hasFilter,
      attributes: ['id', 'name', 'branch_id'],
      include: nestedIncludes
    };
  }

  static async list(req, res) {
    try {
      const {
        role, group_id, mentor_id, direction_id, search, branch_id, page = 1, limit = 20
      } = req.query;
      const where = { is_active: true };

      if (role) where.role = role;
      if (search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } }
        ];
      }

      if (UserRoleService.isManager(req.user)) {
        where.role = { [Op.ne]: USER_ROLES.SUPER_ADMIN };
        if (req.user.branchId && role === USER_ROLES.STUDENT) {
          // students filtered by branch via groups below
        } else if (req.user.branchId) {
          where.branch_id = req.user.branchId;
        }
      } else if (branch_id && UserRoleService.isSuperAdmin(req.user)) {
        where.branch_id = branch_id;
      }

      if (UserRoleService.isSuperAdmin(req.user) && !role) {
        where.role = { [Op.ne]: USER_ROLES.STUDENT };
      }

      const include = [{ model: Branch, as: 'branch', attributes: ['id', 'name'] }];

      const groupIds = UserController.parseIdList(group_id);
      const mentorIds = UserController.parseIdList(mentor_id);
      const directionIds = UserController.parseIdList(direction_id);

      if (role === USER_ROLES.STUDENT) {
        include.push(UserController.buildStudentGroupsInclude(req, { groupIds, mentorIds, directionIds }));
      } else if (groupIds.length === 1) {
        include.push({
          model: Group,
          as: 'mentorGroups',
          where: { id: groupIds[0] },
          required: true
        });
      } else if (groupIds.length > 1) {
        include.push({
          model: Group,
          as: 'mentorGroups',
          where: { id: { [Op.in]: groupIds } },
          required: true
        });
      }

      const offset = (page - 1) * limit;
      const result = await User.findAndCountAll({
        where,
        include,
        distinct: true,
        order: [['name', 'ASC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return sendSuccess(res, {
        users: result.rows,
        pagination: {
          total: result.count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(result.count / limit)
        }
      });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async create(req, res) {
    try {
      const {
        name, email, password, role, phone, avatar_url, group_ids, group_id, branch_id, branch_ids, salary
      } = req.body;

      if (!name || !email || !password || !role) {
        return sendError(res, 'Имя, email, пароль и роль обязательны', HTTP_STATUS.BAD_REQUEST);
      }

      const resolvedBranchIds = UserRoleService.validateCreateUser(req.user, { role, branch_id, branch_ids });
      const resolvedBranchId = resolvedBranchIds[0] || null;

      const user = await AuthService.createUser({
        name,
        email,
        password,
        role,
        phone,
        avatar_url,
        branch_id: resolvedBranchId,
        branch_ids: resolvedBranchIds,
        salary: UserRoleService.isSuperAdmin(req.user) ? salary : undefined
      });

      if (role === USER_ROLES.STUDENT) {
        const studentGroupId = group_id ?? group_ids?.[0];
        if (studentGroupId) {
          await GroupStudent.create({ group_id: studentGroupId, user_id: user.id });
        }
      }

      const created = await User.findByPk(user.id, {
        include: [
          { model: Branch, as: 'branch', attributes: ['id', 'name'] },
          { model: Branch, as: 'branches', attributes: ['id', 'name'], through: { attributes: [] } }
        ]
      });

      return sendSuccess(res, { user: created }, 'Пользователь создан', HTTP_STATUS.CREATED);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async getById(req, res) {
    try {
      const user = await User.findByPk(req.params.id, {
        include: [
          { model: Branch, as: 'branch', attributes: ['id', 'name'] },
          {
            model: Group,
            as: 'studentGroups',
            include: [
              { model: Direction, as: 'direction' },
              { model: Branch, as: 'branch', attributes: ['id', 'name'] }
            ]
          },
          { model: Group, as: 'mentorGroups', include: [{ model: Direction, as: 'direction' }] }
        ]
      });

      if (!user) return sendError(res, 'Пользователь не найден', HTTP_STATUS.NOT_FOUND);

      if (UserRoleService.isManager(req.user) && req.user.branchId) {
        if (user.role === USER_ROLES.STUDENT) {
          const inBranch = user.studentGroups?.some((g) => g.branch_id === req.user.branchId);
          if (!inBranch) return sendError(res, 'Доступ запрещен', HTTP_STATUS.FORBIDDEN);
        } else if (user.branch_id !== req.user.branchId) {
          return sendError(res, 'Доступ запрещен', HTTP_STATUS.FORBIDDEN);
        }
      }

      let pointsBalance = null;
      if (user.role === USER_ROLES.STUDENT) {
        pointsBalance = await PointsService.getBalance(user.id);
      }

      return sendSuccess(res, { user, pointsBalance });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async update(req, res) {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) return sendError(res, 'Пользователь не найден', HTTP_STATUS.NOT_FOUND);

      const {
        name, email, phone, avatar_url, role, is_active, password, group_ids, group_id, branch_id, branch_ids, salary
      } = req.body;

      UserRoleService.validateUpdateUser(req.user, user, { role, branch_id, branch_ids });

      const updates = {};
      if (name) updates.name = name;
      if (email) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (avatar_url !== undefined) updates.avatar_url = avatar_url;
      if (role) updates.role = role;
      if (is_active !== undefined) updates.is_active = is_active;
      if (password) updates.password_hash = await AuthService.hashPassword(password);

      if (branch_ids !== undefined && UserRoleService.isSuperAdmin(req.user)) {
        const BranchAccessService = require('../services/branchAccessService');
        await BranchAccessService.syncUserBranches(user.id, branch_ids);
      } else if (branch_id !== undefined && UserRoleService.isSuperAdmin(req.user)) {
        const BranchAccessService = require('../services/branchAccessService');
        await BranchAccessService.syncUserBranches(user.id, branch_id ? [branch_id] : []);
      }

      if (salary !== undefined && UserRoleService.isSuperAdmin(req.user)) {
        updates.salary = salary;
      }

      await user.update(updates);

      if (user.role === USER_ROLES.STUDENT && (group_id !== undefined || group_ids !== undefined)) {
        const studentGroupId = group_id ?? group_ids?.[0] ?? null;
        await GroupStudent.destroy({ where: { user_id: user.id } });
        if (studentGroupId) {
          await GroupStudent.create({ group_id: studentGroupId, user_id: user.id });
        }
      }

      const updated = await User.findByPk(user.id, {
        include: [
          { model: Branch, as: 'branch', attributes: ['id', 'name'] },
          { model: Branch, as: 'branches', attributes: ['id', 'name'], through: { attributes: [] } }
        ]
      });

      return sendSuccess(res, { user: updated }, 'Пользователь обновлен');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async uploadAvatar(req, res) {
    try {
      if (!req.file) {
        return sendError(res, 'Файл аватара обязателен (поле avatar)', HTTP_STATUS.BAD_REQUEST);
      }

      const user = await User.findByPk(req.params.id);
      if (!user) return sendError(res, 'Пользователь не найден', HTTP_STATUS.NOT_FOUND);

      const isSelf = req.user.userId === user.id;
      if (!isSelf && !UserRoleService.isSuperAdmin(req.user) && !UserRoleService.isManager(req.user)) {
        return sendError(res, 'Доступ запрещен', HTTP_STATUS.FORBIDDEN);
      }

      if (UserRoleService.isManager(req.user) && !isSelf && req.user.branchId) {
        if (user.role === USER_ROLES.STUDENT) {
          const branchGroups = await Group.findAll({
            where: { branch_id: req.user.branchId },
            attributes: ['id']
          });
          const groupIds = branchGroups.map((g) => g.id);
          const link = groupIds.length
            ? await GroupStudent.findOne({ where: { user_id: user.id, group_id: groupIds } })
            : null;
          if (!link) return sendError(res, 'Доступ запрещен', HTTP_STATUS.FORBIDDEN);
        } else if (user.branch_id !== req.user.branchId) {
          return sendError(res, 'Доступ запрещен', HTTP_STATUS.FORBIDDEN);
        }
      }

      const oldFilename = avatarFilenameFromUrl(user.avatar_url);
      if (oldFilename && !oldFilename.startsWith('http')) {
        const oldPath = path.join(AVATAR_DIR, oldFilename);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      const avatarUrl = buildAvatarUrl(req, req.file.filename);
      await user.update({ avatar_url: avatarUrl });

      return sendSuccess(res, { user: user.toJSON() }, 'Фото профиля обновлено');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async archive(req, res) {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) return sendError(res, 'Пользователь не найден', HTTP_STATUS.NOT_FOUND);

      if (UserRoleService.isManager(req.user)) {
        if (user.role !== USER_ROLES.STUDENT) {
          return sendError(res, 'Менеджер может архивировать только студентов', HTTP_STATUS.FORBIDDEN);
        }
        if (req.user.branchId) {
          const branchGroups = await Group.findAll({
            where: { branch_id: req.user.branchId },
            attributes: ['id']
          });
          const groupIds = branchGroups.map((g) => g.id);
          const link = groupIds.length
            ? await GroupStudent.findOne({ where: { user_id: user.id, group_id: groupIds } })
            : null;
          if (!link) return sendError(res, 'Доступ запрещен', HTTP_STATUS.FORBIDDEN);
        }
      }

      if (UserRoleService.isSuperAdmin(req.user) && user.role === USER_ROLES.SUPER_ADMIN) {
        const superAdminCount = await User.count({ where: { role: USER_ROLES.SUPER_ADMIN, is_active: true } });
        if (superAdminCount <= 1) {
          return sendError(res, 'Нельзя удалить последнего супер-админа', HTTP_STATUS.FORBIDDEN);
        }
      }

      await user.update({ is_active: false });
      return sendSuccess(res, null, 'Пользователь архивирован');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }
}

module.exports = UserController;
