const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MentorRating = sequelize.define('MentorRating', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  mentor_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  student_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  stars: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 5 }
  },
  review_text: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  week_number: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'mentor_ratings',
  indexes: [
    { unique: true, fields: ['mentor_id', 'student_id', 'week_number', 'year'] }
  ]
});

module.exports = MentorRating;
