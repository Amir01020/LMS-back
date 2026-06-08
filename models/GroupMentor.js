const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GroupMentor = sequelize.define('GroupMentor', {
  group_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  }
}, {
  tableName: 'group_mentors',
  timestamps: false
});

module.exports = GroupMentor;
