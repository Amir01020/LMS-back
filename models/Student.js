const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { STUDENT_STATUS } = require('../utils/constants');

const Student = sequelize.define('Student', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  first_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Имя не может быть пустым'
      },
      len: {
        args: [2, 50],
        msg: 'Имя должно содержать от 2 до 50 символов'
      },
      is: {
        args: /^[а-яёА-ЯЁa-zA-Z\s-]+$/,
        msg: 'Имя может содержать только буквы, пробелы и дефисы'
      }
    }
  },
  
  last_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Фамилия не может быть пустой'
      },
      len: {
        args: [2, 50],
        msg: 'Фамилия должна содержать от 2 до 50 символов'
      },
      is: {
        args: /^[а-яёА-ЯЁa-zA-Z\s-]+$/,
        msg: 'Фамилия может содержать только буквы, пробелы и дефисы'
      }
    }
  },
  
  middle_name: {
    type: DataTypes.STRING(50),
    allowNull: true,
    validate: {
      len: {
        args: [0, 50],
        msg: 'Отчество не может превышать 50 символов'
      },
      is: {
        args: /^[а-яёА-ЯЁa-zA-Z\s-]*$/,
        msg: 'Отчество может содержать только буквы, пробелы и дефисы'
      }
    }
  },
  
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: {
        msg: 'Телефон не может быть пустым'
      },
      is: {
        args: /^\+998\d{9}$/,
        msg: 'Телефон должен быть в формате +998XXXXXXXXX'
      }
    }
  },
  
  photo: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isUrl: {
        msg: 'Фото должно быть корректным URL или путем к файлу'
      }
    }
  },
  
  balance: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    validate: {
      isDecimal: {
        msg: 'Баланс должен быть числом'
      },
      min: {
        args: [0],
        msg: 'Баланс не может быть отрицательным'
      }
    }
  },
  
  status: {
    type: DataTypes.ENUM(
      STUDENT_STATUS.ACTIVE,
      STUDENT_STATUS.DEBTOR,
      STUDENT_STATUS.COMPLETED,
      STUDENT_STATUS.INACTIVE
    ),
    allowNull: false,
    defaultValue: STUDENT_STATUS.ACTIVE,
    validate: {
      isIn: {
        args: [Object.values(STUDENT_STATUS)],
        msg: 'Недопустимый статус студента'
      }
    }
  },
  
  // Дополнительные поля для отслеживания
  registration_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  
  birth_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    validate: {
      isDate: {
        msg: 'Дата рождения должна быть корректной датой'
      },
      isBefore: {
        args: new Date().toISOString().split('T')[0],
        msg: 'Дата рождения не может быть в будущем'
      }
    }
  },
  
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: {
        args: [0, 500],
        msg: 'Заметки не могут превышать 500 символов'
      }
    }
  }
}, {
  tableName: 'students',
  timestamps: true,
  
  // Индексы для оптимизации
  indexes: [
    {
      unique: true,
      fields: ['phone']
    },
    {
      fields: ['status']
    },
    {
      fields: ['balance']
    },
    {
      fields: ['last_name', 'first_name']
    },
    {
      fields: ['registration_date']
    }
  ],
  
  // Хуки модели
  hooks: {
    beforeCreate: (student, options) => {
      // Обрезаем пробелы и приводим к правильному регистру
      student.first_name = student.first_name.trim();
      student.last_name = student.last_name.trim();
      if (student.middle_name) {
        student.middle_name = student.middle_name.trim();
      }
      
      // Нормализуем телефон
      student.phone = student.phone.replace(/\s+/g, '');
    },
    
    beforeUpdate: (student, options) => {
      if (student.changed('first_name')) {
        student.first_name = student.first_name.trim();
      }
      if (student.changed('last_name')) {
        student.last_name = student.last_name.trim();
      }
      if (student.changed('middle_name') && student.middle_name) {
        student.middle_name = student.middle_name.trim();
      }
      if (student.changed('phone')) {
        student.phone = student.phone.replace(/\s+/g, '');
      }
    }
  }
});

// Методы экземпляра
Student.prototype.toJSON = function() {
  const values = { ...this.get() };
  
  // Форматируем баланс
  if (values.balance) {
    values.balance = parseFloat(values.balance);
  }
  
  return values;
};

// Получить полное имя студента
Student.prototype.getFullName = function() {
  const parts = [this.last_name, this.first_name];
  if (this.middle_name) {
    parts.push(this.middle_name);
  }
  return parts.join(' ');
};

// Проверить является ли студент должником
Student.prototype.isDebtor = function() {
  return this.status === STUDENT_STATUS.DEBTOR || this.balance <= 0;
};

// Проверить может ли студент посещать занятия
Student.prototype.canAttend = function() {
  return [STUDENT_STATUS.ACTIVE, STUDENT_STATUS.DEBTOR].includes(this.status);
};

// Статические методы
Student.findByPhone = function(phone) {
  return this.findOne({
    where: {
      phone: phone.replace(/\s+/g, '')
    }
  });
};

Student.findByStatus = function(status) {
  return this.findAll({
    where: { status },
    order: [['last_name', 'ASC'], ['first_name', 'ASC']]
  });
};

Student.findDebtors = function() {
  return this.findAll({
    where: {
      status: STUDENT_STATUS.DEBTOR
    },
    order: [['last_name', 'ASC'], ['first_name', 'ASC']]
  });
};

Student.findActive = function() {
  return this.findAll({
    where: {
      status: [STUDENT_STATUS.ACTIVE, STUDENT_STATUS.DEBTOR]
    },
    order: [['last_name', 'ASC'], ['first_name', 'ASC']]
  });
};

// Поиск по имени (частичное совпадение)
Student.searchByName = function(searchTerm) {
  const { Op } = require('sequelize');
  
  return this.findAll({
    where: {
      [Op.or]: [
        { first_name: { [Op.like]: `%${searchTerm}%` } },
        { last_name: { [Op.like]: `%${searchTerm}%` } },
        { middle_name: { [Op.like]: `%${searchTerm}%` } }
      ]
    },
    order: [['last_name', 'ASC'], ['first_name', 'ASC']]
  });
};

module.exports = Student;