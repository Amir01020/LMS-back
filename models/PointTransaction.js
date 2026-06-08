const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { POINT_TRANSACTION_TYPE } = require('../utils/constants');

const PointTransaction = sequelize.define('PointTransaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  student_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM(...Object.values(POINT_TRANSACTION_TYPE)),
    allowNull: false
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'point_transactions',
  updatedAt: false
});

module.exports = PointTransaction;
