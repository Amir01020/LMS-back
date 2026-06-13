const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { ENROLLMENT_STATUS } = require('../utils/constants');

const GroupStudent = sequelize.define('GroupStudent', {
  group_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  joined_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  status: {
    type: DataTypes.ENUM(...Object.values(ENROLLMENT_STATUS)),
    defaultValue: ENROLLMENT_STATUS.ACTIVE
  },
  frozen_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  left_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'group_students',
  updatedAt: false
});

module.exports = GroupStudent;
