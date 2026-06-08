const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Direction = sequelize.define('Direction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  color: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  icon: {
    type: DataTypes.STRING(100),
    allowNull: true
  }
}, {
  tableName: 'directions'
});

module.exports = Direction;
