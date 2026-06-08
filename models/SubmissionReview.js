const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SubmissionReview = sequelize.define('SubmissionReview', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  submission_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  reviewer_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  score: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  reviewed_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  needs_revision: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'submission_reviews',
  updatedAt: false
});

module.exports = SubmissionReview;
