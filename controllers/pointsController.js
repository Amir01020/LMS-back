const PointsService = require('../services/pointsService');
const NotificationService = require('../services/notificationService');
const { NOTIFICATION_TYPES, POINT_TRANSACTION_TYPE, HTTP_STATUS } = require('../utils/constants');
const { sendSuccess, sendError } = require('../utils/response');

class PointsController {
  static async getPoints(req, res) {
    try {
      const studentId = req.params.id;
      const balance = await PointsService.getBalance(studentId);
      const history = await PointsService.getHistory(studentId);
      return sendSuccess(res, { balance, history });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async addPoints(req, res) {
    try {
      const { amount, description, type } = req.body;
      if (!amount) return sendError(res, 'Количество баллов обязательно', HTTP_STATUS.BAD_REQUEST);

      const transaction = await PointsService.addPoints(
        req.params.id,
        amount,
        type || POINT_TRANSACTION_TYPE.MANUAL,
        description,
        req.user.userId
      );

      await NotificationService.create(
        req.params.id,
        NOTIFICATION_TYPES.POINTS_AWARDED,
        'Начисление баллов',
        `+${amount} баллов: ${description || ''}`,
        transaction.id,
        'point_transaction'
      );

      const balance = await PointsService.getBalance(req.params.id);
      return sendSuccess(res, { transaction, balance }, 'Баллы начислены', HTTP_STATUS.CREATED);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }
}

module.exports = PointsController;
