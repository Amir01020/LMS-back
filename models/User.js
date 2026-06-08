const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { USER_ROLES } = require('../utils/constants');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM(...Object.values(USER_ROLES)),
    allowNull: false
  },
  avatar_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  branch_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  salary: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    defaultValue: null
  }
}, {
  tableName: 'users',
  indexes: [
    { unique: true, fields: ['email'] },
    { fields: ['role'] },
    { fields: ['is_active'] },
    { fields: ['branch_id'] }
  ],
  hooks: {
    beforeCreate: (user) => {
      user.email = user.email.toLowerCase().trim();
    },
    beforeUpdate: (user) => {
      if (user.changed('email')) {
        user.email = user.email.toLowerCase().trim();
      }
    }
  }
});

User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password_hash;
  if (values.salary !== null && values.salary !== undefined) {
    values.salary = parseFloat(values.salary);
  }
  return values;
};

User.findByEmail = function (email) {
  return this.findOne({ where: { email: email.toLowerCase().trim() } });
};

module.exports = User;
