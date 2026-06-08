const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { NOTIFICATION_TYPES } = require('../utils/constants');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM(...Object.values(NOTIFICATION_TYPES)),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  entity_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  entity_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  }
}, {
  tableName: 'notifications',
  updatedAt: false
});

module.exports = Notification;
