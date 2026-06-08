const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BranchIncome = sequelize.define('BranchIncome', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  branch_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  income_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  student_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'branch_incomes',
  indexes: [
    { fields: ['branch_id'] },
    { fields: ['income_date'] },
    { fields: ['branch_id', 'income_date'] }
  ]
});

BranchIncome.prototype.toJSON = function () {
  const values = { ...this.get() };
  if (values.amount !== undefined) {
    values.amount = parseFloat(values.amount);
  }
  return values;
};

module.exports = BranchIncome;
