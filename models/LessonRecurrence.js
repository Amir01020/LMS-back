const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { RECURRENCE_PATTERN } = require('../utils/constants');

const LessonRecurrence = sequelize.define('LessonRecurrence', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  lesson_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  pattern: {
    type: DataTypes.ENUM(...Object.values(RECURRENCE_PATTERN)),
    allowNull: false
  },
  until_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  }
}, {
  tableName: 'lesson_recurrences',
  updatedAt: false
});

module.exports = LessonRecurrence;
