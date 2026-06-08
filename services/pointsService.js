const { PointTransaction } = require('../models');
const { POINT_TRANSACTION_TYPE } = require('../utils/constants');

class PointsService {
  static async getBalance(studentId) {
    const result = await PointTransaction.sum('amount', {
      where: { student_id: studentId }
    });
    return result || 0;
  }

  static async addPoints(studentId, amount, type, description, createdBy = null) {
    return PointTransaction.create({
      student_id: studentId,
      amount: Math.abs(amount),
      type,
      description,
      created_by: createdBy
    });
  }

  static async spendPoints(studentId, amount, description, createdBy = null) {
    const balance = await this.getBalance(studentId);
    if (balance < amount) {
      throw new Error('Недостаточно баллов');
    }

    return PointTransaction.create({
      student_id: studentId,
      amount: -Math.abs(amount),
      type: POINT_TRANSACTION_TYPE.SPENT,
      description,
      created_by: createdBy
    });
  }

  static async getHistory(studentId, limit = 50) {
    return PointTransaction.findAll({
      where: { student_id: studentId },
      order: [['created_at', 'DESC']],
      limit
    });
  }
}

module.exports = PointsService;
