const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BranchBudget = sequelize.define('BranchBudget', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  branch_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  month: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 12
    }
  },
  allocated_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  notes: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'branch_budgets',
  indexes: [
    { unique: true, fields: ['branch_id', 'year', 'month'] },
    { fields: ['year', 'month'] }
  ]
});

BranchBudget.prototype.toJSON = function () {
  const values = { ...this.get() };
  if (values.allocated_amount !== undefined) {
    values.allocated_amount = parseFloat(values.allocated_amount);
  }
  return values;
};

module.exports = BranchBudget;
