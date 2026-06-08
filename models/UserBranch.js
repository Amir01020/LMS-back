const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserBranch = sequelize.define('UserBranch', {
  user_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  branch_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  }
}, {
  tableName: 'user_branches',
  updatedAt: false,
  indexes: [
    { fields: ['branch_id'] }
  ]
});

module.exports = UserBranch;
