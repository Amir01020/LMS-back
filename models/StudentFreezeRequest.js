const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { FREEZE_REQUEST_STATUS } = require('../utils/constants');

const StudentFreezeRequest = sequelize.define('StudentFreezeRequest', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  student_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  group_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  branch_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM(...Object.values(FREEZE_REQUEST_STATUS)),
    defaultValue: FREEZE_REQUEST_STATUS.PENDING
  },
  reviewed_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  reviewed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  manager_comment: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'student_freeze_requests',
  indexes: [
    { fields: ['student_id'] },
    { fields: ['branch_id', 'status'] },
    { fields: ['status'] }
  ]
});

module.exports = StudentFreezeRequest;
