const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PasswordResetToken = sequelize.define('PasswordResetToken', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  code: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  is_used: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'password_reset_tokens'
});

module.exports = PasswordResetToken;
