const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

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
  }
}, {
  tableName: 'group_students',
  updatedAt: false
});

module.exports = GroupStudent;
