require('dotenv').config();
const { sequelize } = require('../models');

const columnExists = async (table, column) => {
  const dialect = sequelize.getDialect();
  if (dialect === 'postgres') {
    const [rows] = await sequelize.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = :table AND column_name = :column LIMIT 1
    `, { replacements: { table, column } });
    return rows.length > 0;
  }

  const [rows] = await sequelize.query(`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column LIMIT 1
  `, { replacements: { table, column } });
  return rows.length > 0;
};

const tableExists = async (table) => {
  const dialect = sequelize.getDialect();
  if (dialect === 'postgres') {
    const [rows] = await sequelize.query(`
      SELECT 1 FROM information_schema.tables WHERE table_name = :table LIMIT 1
    `, { replacements: { table } });
    return rows.length > 0;
  }

  const [rows] = await sequelize.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = :table LIMIT 1
  `, { replacements: { table } });
  return rows.length > 0;
};

const migrateRoleToManager = async (dialect) => {
  if (dialect === 'postgres') {
    const [managerEnum] = await sequelize.query(`
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'enum_users_role' AND e.enumlabel = 'manager'
      LIMIT 1
    `);
    if (!managerEnum.length) {
      await sequelize.query(`ALTER TYPE "enum_users_role" ADD VALUE 'manager'`);
      console.log('  + enum manager');
    }
    await sequelize.query(`UPDATE users SET role = 'manager' WHERE role = 'admin'`);
    console.log('  ~ admin -> manager');
  } else if (dialect === 'mysql') {
    await sequelize.query(`
      ALTER TABLE users MODIFY COLUMN role
      ENUM('super_admin', 'manager', 'mentor', 'support', 'student') NOT NULL
    `);
    await sequelize.query(`UPDATE users SET role = 'manager' WHERE role = 'admin'`);
    console.log('  ~ users.role enum + admin -> manager');
  }
};

const migratePostgres = async () => {
  const [enumRows] = await sequelize.query(`
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'enum_users_role' AND e.enumlabel = 'super_admin'
    LIMIT 1
  `);
  if (!enumRows.length) {
    await sequelize.query(`ALTER TYPE "enum_users_role" ADD VALUE 'super_admin'`);
    console.log('  + enum super_admin');
  }

  if (!(await columnExists('users', 'branch_id'))) {
    await sequelize.query('ALTER TABLE users ADD COLUMN branch_id INTEGER NULL');
    console.log('  + users.branch_id');
  }
  if (!(await columnExists('users', 'salary'))) {
    await sequelize.query('ALTER TABLE users ADD COLUMN salary DECIMAL(12,2) NULL');
    console.log('  + users.salary');
  }
  if (!(await columnExists('groups', 'branch_id'))) {
    await sequelize.query('ALTER TABLE groups ADD COLUMN branch_id INTEGER NULL');
    console.log('  + groups.branch_id');
  }

  if (!(await tableExists('branches'))) {
    await sequelize.query(`
      CREATE TABLE branches (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        address VARCHAR(500),
        phone VARCHAR(30),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log('  + branches');
  }

  if (!(await tableExists('branch_budgets'))) {
    await sequelize.query(`
      CREATE TABLE branch_budgets (
        id SERIAL PRIMARY KEY,
        branch_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        allocated_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        notes VARCHAR(500),
        created_by INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(branch_id, year, month)
      )
    `);
    console.log('  + branch_budgets');
  }

  if (!(await tableExists('branch_incomes'))) {
    await sequelize.query(`
      CREATE TABLE branch_incomes (
        id SERIAL PRIMARY KEY,
        branch_id INTEGER NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        income_date DATE NOT NULL DEFAULT CURRENT_DATE,
        description VARCHAR(500),
        student_id INTEGER,
        created_by INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log('  + branch_incomes');
  }

  if (!(await tableExists('salary_payments'))) {
    await sequelize.query(`
      CREATE TABLE salary_payments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        branch_id INTEGER,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        is_paid BOOLEAN DEFAULT false,
        paid_at TIMESTAMPTZ,
        paid_by INTEGER,
        notes VARCHAR(500),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, year, month)
      )
    `);
    console.log('  + salary_payments');
  }

  await migrateRoleToManager('postgres');

  if (!(await tableExists('user_branches'))) {
    await sequelize.query(`
      CREATE TABLE user_branches (
        user_id INTEGER NOT NULL,
        branch_id INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, branch_id)
      )
    `);
    console.log('  + user_branches');
  }

  if (!(await tableExists('branch_shop_items'))) {
    await sequelize.query(`
      CREATE TABLE branch_shop_items (
        id SERIAL PRIMARY KEY,
        branch_id INTEGER NOT NULL,
        shop_item_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(branch_id, shop_item_id)
      )
    `);
    console.log('  + branch_shop_items');
  }

  if (!(await columnExists('orders', 'branch_id'))) {
    await sequelize.query('ALTER TABLE orders ADD COLUMN branch_id INTEGER NULL');
    console.log('  + orders.branch_id');
  }

  const userBranchHasCreatedAt = await columnExists('user_branches', 'created_at');
  const insertCols = userBranchHasCreatedAt ? '(user_id, branch_id, created_at)' : '(user_id, branch_id)';
  const insertVals = userBranchHasCreatedAt
    ? 'SELECT id, branch_id, NOW() FROM users WHERE branch_id IS NOT NULL'
    : 'SELECT id, branch_id FROM users WHERE branch_id IS NOT NULL';

  await sequelize.query(`
    INSERT INTO user_branches ${insertCols}
    ${insertVals}
    ON CONFLICT DO NOTHING
  `);
};

const migrateMysql = async () => {
  if (!(await columnExists('users', 'branch_id'))) {
    await sequelize.query('ALTER TABLE users ADD COLUMN branch_id INT NULL');
    console.log('  + users.branch_id');
  }
  if (!(await columnExists('users', 'salary'))) {
    await sequelize.query('ALTER TABLE users ADD COLUMN salary DECIMAL(12,2) NULL');
    console.log('  + users.salary');
  }
  if (!(await columnExists('groups', 'branch_id'))) {
    await sequelize.query('ALTER TABLE groups ADD COLUMN branch_id INT NULL');
    console.log('  + groups.branch_id');
  }

  if (!(await tableExists('branches'))) {
    await sequelize.query(`
      CREATE TABLE branches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        address VARCHAR(500),
        phone VARCHAR(30),
        is_active TINYINT(1) DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('  + branches');
  }

  if (!(await tableExists('branch_budgets'))) {
    await sequelize.query(`
      CREATE TABLE branch_budgets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        branch_id INT NOT NULL,
        year INT NOT NULL,
        month INT NOT NULL,
        allocated_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        notes VARCHAR(500),
        created_by INT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_branch_budget (branch_id, year, month)
      )
    `);
    console.log('  + branch_budgets');
  }

  if (!(await tableExists('branch_incomes'))) {
    await sequelize.query(`
      CREATE TABLE branch_incomes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        branch_id INT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        income_date DATE NOT NULL DEFAULT (CURRENT_DATE),
        description VARCHAR(500),
        student_id INT,
        created_by INT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('  + branch_incomes');
  }

  if (!(await tableExists('salary_payments'))) {
    await sequelize.query(`
      CREATE TABLE salary_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        branch_id INT,
        year INT NOT NULL,
        month INT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        is_paid TINYINT(1) DEFAULT 0,
        paid_at DATETIME,
        paid_by INT,
        notes VARCHAR(500),
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_salary_payment (user_id, year, month)
      )
    `);
    console.log('  + salary_payments');
  }

  await migrateRoleToManager('mysql');

  if (!(await tableExists('user_branches'))) {
    await sequelize.query(`
      CREATE TABLE user_branches (
        user_id INT NOT NULL,
        branch_id INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, branch_id)
      )
    `);
    console.log('  + user_branches');
  }

  if (!(await tableExists('branch_shop_items'))) {
    await sequelize.query(`
      CREATE TABLE branch_shop_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        branch_id INT NOT NULL,
        shop_item_id INT NOT NULL,
        quantity INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_branch_shop_item (branch_id, shop_item_id)
      )
    `);
    console.log('  + branch_shop_items');
  }

  if (!(await columnExists('orders', 'branch_id'))) {
    await sequelize.query('ALTER TABLE orders ADD COLUMN branch_id INT NULL');
    console.log('  + orders.branch_id');
  }

  await sequelize.query(`
    INSERT IGNORE INTO user_branches (user_id, branch_id)
    SELECT id, branch_id FROM users WHERE branch_id IS NOT NULL
  `);
};

const migrate = async () => {
  await sequelize.authenticate();
  const dialect = sequelize.getDialect();
  console.log(`🔄 Миграция схемы (${dialect})...`);

  if (dialect === 'postgres') {
    await migratePostgres();
  } else if (dialect === 'mysql') {
    await migrateMysql();
  } else {
    throw new Error(`Неподдерживаемый диалект: ${dialect}`);
  }

  console.log('✅ Миграция завершена');
};

if (require.main === module) {
  migrate()
    .catch((error) => {
      console.error('❌ Ошибка миграции:', error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await sequelize.close();
    });
}

module.exports = { migrate };
