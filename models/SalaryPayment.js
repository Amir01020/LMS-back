const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SalaryPayment = sequelize.define('SalaryPayment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  branch_id: {
    type: DataTypes.INTEGER,
    allowNull: true
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
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  is_paid: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  paid_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  paid_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  notes: {
    type: DataTypes.STRING(500),
    allowNull: true
  }
}, {
  tableName: 'salary_payments',
  indexes: [
    { unique: true, fields: ['user_id', 'year', 'month'] },
    { fields: ['branch_id', 'year', 'month'] },
    { fields: ['is_paid'] }
  ]
});

SalaryPayment.prototype.toJSON = function () {
  const values = { ...this.get() };
  if (values.amount !== undefined) {
    values.amount = parseFloat(values.amount);
  }
  return values;
};

module.exports = SalaryPayment;
