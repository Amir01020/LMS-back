const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SubmissionAttachment = sequelize.define('SubmissionAttachment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  submission_id: {
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
  }
}, {
  tableName: 'submission_attachments',
  updatedAt: false
});

module.exports = SubmissionAttachment;
