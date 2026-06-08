const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { GROUP_STATUS } = require('../utils/constants');

const Group = sequelize.define('Group', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  direction_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM(...Object.values(GROUP_STATUS)),
    defaultValue: GROUP_STATUS.ACTIVE
  },
  start_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  end_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  branch_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'groups',
  indexes: [
    { fields: ['branch_id'] }
  ]
});

module.exports = Group;
