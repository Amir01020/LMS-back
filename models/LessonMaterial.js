const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LessonMaterial = sequelize.define('LessonMaterial', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  lesson_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  file_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  type: {
    type: DataTypes.STRING(50),
    allowNull: true
  }
}, {
  tableName: 'lesson_materials',
  updatedAt: false
});

module.exports = LessonMaterial;
