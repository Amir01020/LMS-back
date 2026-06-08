require('dotenv').config();
const { sequelize, syncDatabase, User } = require('../models');
const AuthService = require('../services/authService');
const { USER_ROLES } = require('../utils/constants');
const { migrate } = require('./migrateSuperAdmin');

const seed = async () => {
  try {
    await sequelize.authenticate();
    await migrate();
    await syncDatabase();

    const email = process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'superadmin@school.local';
    const password = process.env.SUPER_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '1111';
    const existing = await User.findByEmail(email);

    if (existing) {
      await existing.update({
        password_hash: await AuthService.hashPassword(password),
        role: USER_ROLES.SUPER_ADMIN,
        is_active: true,
        branch_id: null
      });
      console.log('✅ Super Admin обновлён:', email, '| пароль:', password);
      return;
    }

    const user = await AuthService.createUser({
      name: 'Super Administrator',
      email,
      password,
      role: USER_ROLES.SUPER_ADMIN
    });

    console.log('✅ Super Admin создан:', user.email, '| пароль:', password);
  } catch (error) {
    console.error('Ошибка seed:', error);
  } finally {
    await sequelize.close();
  }
};

seed();
