const { Notification } = require('../models');

class NotificationService {
  static async create(userId, type, title, message, entityId = null, entityType = null) {
    return Notification.create({
      user_id: userId,
      type,
      title,
      message,
      entity_id: entityId,
      entity_type: entityType
    });
  }

  static async createForUsers(userIds, type, title, message, entityId = null, entityType = null) {
    const records = userIds.map((userId) => ({
      user_id: userId,
      type,
      title,
      message,
      entity_id: entityId,
      entity_type: entityType
    }));
    return Notification.bulkCreate(records);
  }
}

module.exports = NotificationService;
