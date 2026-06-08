const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Attendance = sequelize.define('Attendance', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  lesson_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  student_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  is_present: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'attendances',
  indexes: [
    { unique: true, fields: ['lesson_id', 'student_id'] }
  ],
  updatedAt: false
});

module.exports = Attendance;
