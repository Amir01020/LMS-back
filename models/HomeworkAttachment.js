const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const HomeworkAttachment = sequelize.define('HomeworkAttachment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  homework_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  file_url: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  file_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  file_type: {
    type: DataTypes.STRING(100),
    allowNull: true
  }
}, {
  tableName: 'homework_attachments',
  updatedAt: false
});

module.exports = HomeworkAttachment;
