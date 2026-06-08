const { Direction, Group } = require('../models');
const { HTTP_STATUS } = require('../utils/constants');
const { sendSuccess, sendError } = require('../utils/response');

class DirectionController {
  static async list(req, res) {
    try {
      const directions = await Direction.findAll({
        include: [{ model: Group, as: 'groups', attributes: ['id', 'name', 'status'] }],
        order: [['name', 'ASC']]
      });
      return sendSuccess(res, { directions });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async create(req, res) {
    try {
      const { name, description, color, icon } = req.body;
      if (!name) return sendError(res, 'Название обязательно', HTTP_STATUS.BAD_REQUEST);
      const direction = await Direction.create({ name, description, color, icon });
      return sendSuccess(res, { direction }, 'Направление создано', HTTP_STATUS.CREATED);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async update(req, res) {
    try {
      const direction = await Direction.findByPk(req.params.id);
      if (!direction) return sendError(res, 'Направление не найдено', HTTP_STATUS.NOT_FOUND);
      await direction.update(req.body);
      return sendSuccess(res, { direction }, 'Направление обновлено');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async remove(req, res) {
    try {
      const direction = await Direction.findByPk(req.params.id);
      if (!direction) return sendError(res, 'Направление не найдено', HTTP_STATUS.NOT_FOUND);
      await direction.destroy();
      return sendSuccess(res, null, 'Направление удалено');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }
}

module.exports = DirectionController;
