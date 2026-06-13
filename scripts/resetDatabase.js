require('dotenv').config();
const { sequelize, syncDatabase } = require('../models');
const AuthService = require('../services/authService');
const { USER_ROLES } = require('../utils/constants');
const { migrate } = require('./migrateSuperAdmin');

const reset = async () => {
  try {
    await sequelize.authenticate();
    console.log('⚠️  Полный сброс базы данных...');

    await syncDatabase(true);
    await migrate();
    await syncDatabase(false);

    const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@school.local';
    const password = process.env.SUPER_ADMIN_PASSWORD || 'superadmin123';

    await AuthService.createUser({
      name: 'Super Administrator',
      email,
      password,
      role: USER_ROLES.SUPER_ADMIN,
      avatar_url: 'https://i.pravatar.cc/150?u=superadmin'
    });

    console.log('✅ База очищена. Оставлен только Super Admin:');
    console.log('   Email:   ', email);
    console.log('   Password:', password);
  } catch (error) {
    console.error('❌ Ошибка сброса:', error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

reset();
