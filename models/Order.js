const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { ORDER_STATUS } = require('../utils/constants');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  student_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  item_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  total_price: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM(...Object.values(ORDER_STATUS)),
    defaultValue: ORDER_STATUS.PENDING
  },
  branch_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  issued_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'orders'
});

module.exports = Order;
