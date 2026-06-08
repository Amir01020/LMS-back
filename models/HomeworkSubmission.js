const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { SUBMISSION_STATUS } = require('../utils/constants');

const HomeworkSubmission = sequelize.define('HomeworkSubmission', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  homework_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  student_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM(...Object.values(SUBMISSION_STATUS)),
    defaultValue: SUBMISSION_STATUS.NOT_STARTED
  },
  submitted_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'homework_submissions'
});

module.exports = HomeworkSubmission;
