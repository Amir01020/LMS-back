const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { HOMEWORK_STATUS } = require('../utils/constants');

const Homework = sequelize.define('Homework', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  lesson_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  group_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  deadline: {
    type: DataTypes.DATE,
    allowNull: false
  },
  max_score: {
    type: DataTypes.INTEGER,
    defaultValue: 100
  },
  status: {
    type: DataTypes.ENUM(...Object.values(HOMEWORK_STATUS)),
    defaultValue: HOMEWORK_STATUS.DRAFT
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  is_visible: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'homeworks'
});

module.exports = Homework;
