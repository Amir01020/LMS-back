const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LessonComment = sequelize.define('LessonComment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  lesson_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  author_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  parent_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'lesson_comments',
  updatedAt: false
});

module.exports = LessonComment;
