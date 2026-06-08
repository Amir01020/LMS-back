const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Branch = sequelize.define('Branch', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  address: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'branches',
  indexes: [
    { fields: ['is_active'] }
  ]
});

module.exports = Branch;
