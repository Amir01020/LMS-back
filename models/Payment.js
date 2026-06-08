const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { PAYMENT_TYPES } = require('../utils/constants');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  student_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'students',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    validate: {
      notEmpty: {
        msg: 'ID студента обязателен'
      }
    }
  },
  
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      isDecimal: {
        msg: 'Сумма должна быть числом'
      },
      notZero(value) {
        if (parseFloat(value) === 0) {
          throw new Error('Сумма не может быть равна нулю');
        }
      }
    }
  },
  
  payment_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    validate: {
      isDate: {
        msg: 'Дата платежа должна быть корректной датой'
      }
    }
  },
  
  payment_type: {
    type: DataTypes.ENUM(
      PAYMENT_TYPES.DEPOSIT,
      PAYMENT_TYPES.MONTHLY_CHARGE,
      PAYMENT_TYPES.REFUND
    ),
    allowNull: false,
    validate: {
      isIn: {
        args: [Object.values(PAYMENT_TYPES)],
        msg: 'Недопустимый тип платежа'
      }
    }
  },
  
  description: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      len: {
        args: [0, 500],
        msg: 'Описание не может превышать 500 символов'
      }
    }
  },
  
  group_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'groups',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
    comment: 'Группа, за которую произведен платеж (для monthly_charge)'
  },
  
  processed_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
    comment: 'Пользователь (админ), который обработал платеж'
  },
  
  is_automatic: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Автоматическое списание или ручное'
  },
  
  balance_before: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    validate: {
      isDecimal: {
        msg: 'Баланс до операции должен быть числом'
      }
    }
  },
  
  balance_after: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      isDecimal: {
        msg: 'Баланс после операции должен быть числом'
      }
    }
  }
}, {
  tableName: 'payments',
  timestamps: true,
  
  // Индексы для оптимизации
  indexes: [
    {
      fields: ['student_id']
    },
    {
      fields: ['payment_date']
    },
    {
      fields: ['payment_type']
    },
    {
      fields: ['group_id']
    },
    {
      fields: ['processed_by']
    },
    {
      fields: ['is_automatic']
    },
    {
      fields: ['student_id', 'payment_date'] // Для истории платежей студента
    },
    {
      fields: ['payment_type', 'payment_date'] // Для отчетов по типам
    }
  ],
  
  // Хуки модели
  hooks: {
    beforeCreate: (payment, options) => {
      if (payment.description) {
        payment.description = payment.description.trim();
      }
    },
    
    beforeUpdate: (payment, options) => {
      if (payment.changed('description') && payment.description) {
        payment.description = payment.description.trim();
      }
    }
  }
});

// Методы экземпляра
Payment.prototype.toJSON = function() {
  const values = { ...this.get() };
  
  // Форматируем суммы
  if (values.amount) {
    values.amount = parseFloat(values.amount);
  }
  if (values.balance_before) {
    values.balance_before = parseFloat(values.balance_before);
  }
  if (values.balance_after) {
    values.balance_after = parseFloat(values.balance_after);
  }
  
  return values;
};

// Проверить является ли операция пополнением
Payment.prototype.isDeposit = function() {
  return this.payment_type === PAYMENT_TYPES.DEPOSIT;
};

// Проверить является ли операция списанием
Payment.prototype.isCharge = function() {
  return this.payment_type === PAYMENT_TYPES.MONTHLY_CHARGE;
};

// Проверить является ли операция возвратом
Payment.prototype.isRefund = function() {
  return this.payment_type === PAYMENT_TYPES.REFUND;
};

// Получить читаемый тип операции
Payment.prototype.getPaymentTypeLabel = function() {
  const labels = {
    [PAYMENT_TYPES.DEPOSIT]: 'Пополнение баланса',
    [PAYMENT_TYPES.MONTHLY_CHARGE]: 'Списание за месяц',
    [PAYMENT_TYPES.REFUND]: 'Возврат средств'
  };
  return labels[this.payment_type] || this.payment_type;
};

// Статические методы
Payment.findByStudent = function(studentId, startDate = null, endDate = null) {
  const { Op } = require('sequelize');
  
  let whereClause = { student_id: studentId };
  
  if (startDate && endDate) {
    whereClause.payment_date = {
      [Op.between]: [startDate, endDate]
    };
  } else if (startDate) {
    whereClause.payment_date = {
      [Op.gte]: startDate
    };
  } else if (endDate) {
    whereClause.payment_date = {
      [Op.lte]: endDate
    };
  }
  
  return this.findAll({
    where: whereClause,
    order: [['payment_date', 'DESC']]
  });
};

Payment.findByType = function(paymentType, startDate = null, endDate = null) {
  const { Op } = require('sequelize');
  
  let whereClause = { payment_type: paymentType };
  
  if (startDate && endDate) {
    whereClause.payment_date = {
      [Op.between]: [startDate, endDate]
    };
  }
  
  return this.findAll({
    where: whereClause,
    order: [['payment_date', 'DESC']]
  });
};

Payment.findByGroup = function(groupId, startDate = null, endDate = null) {
  const { Op } = require('sequelize');
  
  let whereClause = { group_id: groupId };
  
  if (startDate && endDate) {
    whereClause.payment_date = {
      [Op.between]: [startDate, endDate]
    };
  }
  
  return this.findAll({
    where: whereClause,
    order: [['payment_date', 'DESC']]
  });
};

// Получить статистику платежей студента
Payment.getStudentStats = async function(studentId, startDate = null, endDate = null) {
  const { Op } = require('sequelize');
  
  let whereClause = { student_id: studentId };
  
  if (startDate && endDate) {
    whereClause.payment_date = {
      [Op.between]: [startDate, endDate]
    };
  }
  
  const stats = await this.findAll({
    where: whereClause,
    attributes: [
      [sequelize.fn('COUNT', sequelize.col('*')), 'total_transactions'],
      [sequelize.fn('SUM', sequelize.literal('CASE WHEN payment_type = "deposit" THEN amount ELSE 0 END')), 'total_deposits'],
      [sequelize.fn('SUM', sequelize.literal('CASE WHEN payment_type = "monthly_charge" THEN ABS(amount) ELSE 0 END')), 'total_charges'],
      [sequelize.fn('SUM', sequelize.literal('CASE WHEN payment_type = "refund" THEN amount ELSE 0 END')), 'total_refunds'],
      [sequelize.fn('COUNT', sequelize.literal('CASE WHEN is_automatic = true THEN 1 END')), 'automatic_transactions']
    ],
    raw: true
  });
  
  const result = stats[0] || {
    total_transactions: 0,
    total_deposits: 0,
    total_charges: 0,
    total_refunds: 0,
    automatic_transactions: 0
  };
  
  // Конвертируем в числа
  Object.keys(result).forEach(key => {
    result[key] = parseFloat(result[key]) || 0;
  });
  
  return result;
};

// Получить общую статистику доходов
Payment.getRevenueStats = async function(startDate = null, endDate = null) {
  const { Op } = require('sequelize');
  
  let whereClause = {
    payment_type: PAYMENT_TYPES.MONTHLY_CHARGE
  };
  
  if (startDate && endDate) {
    whereClause.payment_date = {
      [Op.between]: [startDate, endDate]
    };
  }
  
  const stats = await this.findAll({
    where: whereClause,
    attributes: [
      [sequelize.fn('COUNT', sequelize.col('*')), 'total_charges'],
      [sequelize.fn('SUM', sequelize.literal('ABS(amount)')), 'total_revenue'],
      [sequelize.fn('COUNT', sequelize.literal('DISTINCT student_id')), 'paying_students'],
      [sequelize.fn('COUNT', sequelize.literal('DISTINCT group_id')), 'revenue_groups']
    ],
    raw: true
  });
  
  const result = stats[0] || {
    total_charges: 0,
    total_revenue: 0,
    paying_students: 0,
    revenue_groups: 0
  };
  
  // Конвертируем в числа
  Object.keys(result).forEach(key => {
    result[key] = parseFloat(result[key]) || 0;
  });
  
  return result;
};

// Получить статистику доходов по курсам
Payment.getRevenueByCourse = async function(startDate = null, endDate = null) {
  const { Op } = require('sequelize');
  const { Group, Course } = require('./index');
  
  let whereClause = {
    payment_type: PAYMENT_TYPES.MONTHLY_CHARGE,
    group_id: { [Op.not]: null }
  };
  
  if (startDate && endDate) {
    whereClause.payment_date = {
      [Op.between]: [startDate, endDate]
    };
  }
  
  return this.findAll({
    where: whereClause,
    include: [{
      model: Group,
      as: 'group',
      attributes: ['id', 'name'],
      include: [{
        model: Course,
        as: 'course',
        attributes: ['id', 'name']
      }]
    }],
    attributes: [
      [sequelize.fn('COUNT', sequelize.col('*')), 'charge_count'],
      [sequelize.fn('SUM', sequelize.literal('ABS(amount)')), 'course_revenue']
    ],
    group: ['group.course.id'],
    order: [[sequelize.literal('course_revenue'), 'DESC']]
  });
};

// Найти студентов с отрицательным балансом после последней операции
Payment.findNegativeBalances = function() {
  return this.findAll({
    where: {
      balance_after: {
        [sequelize.Op.lt]: 0
      }
    },
    attributes: [
      'student_id',
      [sequelize.fn('MAX', sequelize.col('payment_date')), 'last_payment_date'],
      [sequelize.literal('(SELECT balance_after FROM payments p2 WHERE p2.student_id = Payment.student_id ORDER BY p2.payment_date DESC LIMIT 1)'), 'current_balance']
    ],
    group: ['student_id'],
    having: sequelize.literal('current_balance < 0'),
    raw: true
  });
};

// Создать платеж и обновить баланс студента
Payment.createPayment = async function(paymentData, transaction = null) {
  const { Student } = require('./index');
  
  const { student_id, amount, payment_type, description, group_id, processed_by, is_automatic } = paymentData;
  
  const options = transaction ? { transaction } : {};
  
  // Получаем текущий баланс студента
  const student = await Student.findByPk(student_id, options);
  if (!student) {
    throw new Error('Студент не найден');
  }
  
  const balanceBefore = parseFloat(student.balance);
  let balanceAfter;
  
  // Вычисляем новый баланс в зависимости от типа операции
  if (payment_type === PAYMENT_TYPES.DEPOSIT || payment_type === PAYMENT_TYPES.REFUND) {
    balanceAfter = balanceBefore + parseFloat(amount);
  } else if (payment_type === PAYMENT_TYPES.MONTHLY_CHARGE) {
    balanceAfter = balanceBefore - Math.abs(parseFloat(amount));
  }
  
  // Создаем запись платежа
  const payment = await Payment.create({
    student_id,
    amount: payment_type === PAYMENT_TYPES.MONTHLY_CHARGE ? -Math.abs(amount) : amount,
    payment_date: new Date(),
    payment_type,
    description: description || null,
    group_id: group_id || null,
    processed_by: processed_by || null,
    is_automatic: is_automatic || false,
    balance_before: balanceBefore,
    balance_after: balanceAfter
  }, options);
  
  // Обновляем баланс студента
  await student.update({ balance: balanceAfter }, options);
  
  return payment;
};

module.exports = Payment;