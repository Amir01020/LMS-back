const { Notification } = require('../models');
const { HTTP_STATUS } = require('../utils/constants');
const { sendSuccess, sendError } = require('../utils/response');

class NotificationController {
  static async list(req, res) {
    try {
      const notifications = await Notification.findAll({
        where: { user_id: req.user.userId },
        order: [['created_at', 'DESC']],
        limit: 50
      });
      const unreadCount = notifications.filter((n) => !n.is_read).length;
      return sendSuccess(res, { notifications, unreadCount });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async markRead(req, res) {
    try {
      const notification = await Notification.findOne({
        where: { id: req.params.id, user_id: req.user.userId }
      });
      if (!notification) return sendError(res, 'Уведомление не найдено', HTTP_STATUS.NOT_FOUND);
      await notification.update({ is_read: true });
      return sendSuccess(res, { notification });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async markAllRead(req, res) {
    try {
      await Notification.update(
        { is_read: true },
        { where: { user_id: req.user.userId, is_read: false } }
      );
      return sendSuccess(res, null, 'Все уведомления прочитаны');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }
}

module.exports = NotificationController;
