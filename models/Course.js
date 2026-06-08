const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Course = sequelize.define('Course', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: {
        msg: 'Название курса не может быть пустым'
      },
      len: {
        args: [2, 100],
        msg: 'Название курса должно содержать от 2 до 100 символов'
      }
    }
  },
  
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: {
        args: [0, 1000],
        msg: 'Описание не может превышать 1000 символов'
      }
    }
  },
  
  price_per_month: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      isDecimal: {
        msg: 'Цена должна быть числом'
      },
      min: {
        args: [0],
        msg: 'Цена не может быть отрицательной'
      },
      max: {
        args: [999999.99],
        msg: 'Цена не может превышать 999,999.99'
      }
    }
  },
  
  duration_months: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      isInt: {
        msg: 'Продолжительность должна быть целым числом'
      },
      min: {
        args: [1],
        msg: 'Продолжительность курса должна быть минимум 1 месяц'
      },
      max: {
        args: [24],
        msg: 'Продолжительность курса не может превышать 24 месяца'
      }
    }
  },
  
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Активен ли курс (можно ли создавать новые группы)'
  }
}, {
  tableName: 'courses',
  timestamps: true,
  
  // Индексы для оптимизации
  indexes: [
    {
      unique: true,
      fields: ['name']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['price_per_month']
    }
  ],
  
  // Хуки модели
  hooks: {
    beforeCreate: (course, options) => {
      // Обрезаем лишние пробелы в названии
      course.name = course.name.trim();
      if (course.description) {
        course.description = course.description.trim();
      }
    },
    
    beforeUpdate: (course, options) => {
      if (course.changed('name')) {
        course.name = course.name.trim();
      }
      if (course.changed('description') && course.description) {
        course.description = course.description.trim();
      }
    }
  }
});

// Методы экземпляра
Course.prototype.toJSON = function() {
  const values = { ...this.get() };
  
  // Форматируем цену
  if (values.price_per_month) {
    values.price_per_month = parseFloat(values.price_per_month);
  }
  
  return values;
};

// Статические методы
Course.findActive = function() {
  return this.findAll({
    where: {
      is_active: true
    },
    order: [['name', 'ASC']]
  });
};

Course.findByName = function(name) {
  return this.findOne({
    where: {
      name: name.trim()
    }
  });
};

// Метод для получения статистики курса
Course.prototype.getStats = async function() {
  // Пока просто базовая информация, потом добавим подсчет групп и студентов
  return {
    id: this.id,
    name: this.name,
    price_per_month: parseFloat(this.price_per_month),
    duration_months: this.duration_months,
    is_active: this.is_active,
    // groups_count: 0, // Добавим когда создадим модель Group
    // students_count: 0 // Добавим когда создадим связи
  };
};

module.exports = Course;