const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Teacher = sequelize.define('Teacher', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    validate: {
      notEmpty: {
        msg: 'ID пользователя обязателен'
      }
    }
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
  
  specialization: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      len: {
        args: [0, 100],
        msg: 'Специализация не может превышать 100 символов'
      }
    }
  },
  
  experience_years: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      isInt: {
        msg: 'Опыт работы должен быть целым числом'
      },
      min: {
        args: [0],
        msg: 'Опыт работы не может быть отрицательным'
      },
      max: {
        args: [50],
        msg: 'Опыт работы не может превышать 50 лет'
      }
    }
  },
  
  hire_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    validate: {
      isDate: {
        msg: 'Дата найма должна быть корректной датой'
      }
    }
  },
  
  salary_per_student: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true,
    validate: {
      isDecimal: {
        msg: 'Зарплата за студента должна быть числом'
      },
      min: {
        args: [0],
        msg: 'Зарплата не может быть отрицательной'
      }
    }
  },
  
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Активен ли учитель (может ли вести группы)'
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
  tableName: 'teachers',
  timestamps: true,
  
  // Индексы для оптимизации
  indexes: [
    {
      unique: true,
      fields: ['user_id']
    },
    {
      unique: true,
      fields: ['phone']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['last_name', 'first_name']
    },
    {
      fields: ['hire_date']
    }
  ],
  
  // Хуки модели
  hooks: {
    beforeCreate: (teacher, options) => {
      // Обрезаем пробелы и приводим к правильному регистру
      teacher.first_name = teacher.first_name.trim();
      teacher.last_name = teacher.last_name.trim();
      if (teacher.middle_name) {
        teacher.middle_name = teacher.middle_name.trim();
      }
      if (teacher.specialization) {
        teacher.specialization = teacher.specialization.trim();
      }
      
      // Нормализуем телефон
      teacher.phone = teacher.phone.replace(/\s+/g, '');
    },
    
    beforeUpdate: (teacher, options) => {
      if (teacher.changed('first_name')) {
        teacher.first_name = teacher.first_name.trim();
      }
      if (teacher.changed('last_name')) {
        teacher.last_name = teacher.last_name.trim();
      }
      if (teacher.changed('middle_name') && teacher.middle_name) {
        teacher.middle_name = teacher.middle_name.trim();
      }
      if (teacher.changed('specialization') && teacher.specialization) {
        teacher.specialization = teacher.specialization.trim();
      }
      if (teacher.changed('phone')) {
        teacher.phone = teacher.phone.replace(/\s+/g, '');
      }
    }
  }
});

// Методы экземпляра
Teacher.prototype.toJSON = function() {
  const values = { ...this.get() };
  
  // Форматируем зарплату
  if (values.salary_per_student) {
    values.salary_per_student = parseFloat(values.salary_per_student);
  }
  
  return values;
};

// Получить полное имя учителя
Teacher.prototype.getFullName = function() {
  const parts = [this.last_name, this.first_name];
  if (this.middle_name) {
    parts.push(this.middle_name);
  }
  return parts.join(' ');
};

// Проверить может ли учитель вести группы
Teacher.prototype.canTeach = function() {
  return this.is_active;
};

// Статические методы
Teacher.findByPhone = function(phone) {
  return this.findOne({
    where: {
      phone: phone.replace(/\s+/g, '')
    }
  });
};

Teacher.findByUserId = function(userId) {
  return this.findOne({
    where: {
      user_id: userId
    }
  });
};

Teacher.findActive = function() {
  return this.findAll({
    where: {
      is_active: true
    },
    order: [['last_name', 'ASC'], ['first_name', 'ASC']]
  });
};

// Поиск по имени (частичное совпадение)
Teacher.searchByName = function(searchTerm) {
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

// Получить статистику учителя
Teacher.prototype.getStats = async function() {
  // Пока базовая информация, потом добавим подсчет групп и студентов
  return {
    id: this.id,
    fullName: this.getFullName(),
    specialization: this.specialization,
    experience_years: this.experience_years,
    salary_per_student: this.salary_per_student ? parseFloat(this.salary_per_student) : null,
    is_active: this.is_active,
    hire_date: this.hire_date,
    // groups_count: 0, // Добавим когда создадим связи
    // active_students_count: 0 // Добавим когда создадим связи
  };
};

module.exports = Teacher;