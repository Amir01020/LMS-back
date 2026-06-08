const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { LESSON_TYPE, LESSON_STATUS } = require('../utils/constants');

const Lesson = sequelize.define('Lesson', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  group_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  mentor_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  start_time: {
    type: DataTypes.TIME,
    allowNull: false
  },
  end_time: {
    type: DataTypes.TIME,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM(...Object.values(LESSON_TYPE)),
    defaultValue: LESSON_TYPE.ONLINE
  },
  conference_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM(...Object.values(LESSON_STATUS)),
    defaultValue: LESSON_STATUS.SCHEDULED
  }
}, {
  tableName: 'lessons'
});

module.exports = Lesson;
