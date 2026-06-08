const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { WEEKDAYS, WEEKDAY_NAMES } = require('../utils/constants');

const Schedule = sequelize.define('Schedule', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  group_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'groups',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    validate: {
      notEmpty: {
        msg: 'ID группы обязателен'
      }
    }
  },
  
  day_of_week: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      isInt: {
        msg: 'День недели должен быть целым числом'
      },
      min: {
        args: [1],
        msg: 'День недели должен быть от 1 (понедельник) до 7 (воскресенье)'
      },
      max: {
        args: [7],
        msg: 'День недели должен быть от 1 (понедельник) до 7 (воскресенье)'
      }
    }
  },
  
  start_time: {
    type: DataTypes.TIME,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Время начала обязательно'
      },
      isValidTime(value) {
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
        if (!timeRegex.test(value)) {
          throw new Error('Время начала должно быть в формате HH:MM:SS');
        }
      }
    }
  },
  
  end_time: {
    type: DataTypes.TIME,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Время окончания обязательно'
      },
      isValidTime(value) {
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
        if (!timeRegex.test(value)) {
          throw new Error('Время окончания должно быть в формате HH:MM:SS');
        }
      },
      isAfterStartTime(value) {
        if (this.start_time && value <= this.start_time) {
          throw new Error('Время окончания должно быть позже времени начала');
        }
      }
    }
  }
}, {
  tableName: 'schedules',
  timestamps: true,
  
  // Индексы для оптимизации
  indexes: [
    {
      fields: ['group_id']
    },
    {
      fields: ['day_of_week']
    },
    {
      fields: ['start_time']
    },
    {
      unique: true,
      fields: ['group_id', 'day_of_week', 'start_time'],
      name: 'unique_group_day_time'
    }
  ],
  
  // Хуки модели
  hooks: {
    beforeCreate: (schedule, options) => {
      // Нормализуем время (добавляем секунды если их нет)
      schedule.start_time = normalizeTime(schedule.start_time);
      schedule.end_time = normalizeTime(schedule.end_time);
    },
    
    beforeUpdate: (schedule, options) => {
      if (schedule.changed('start_time')) {
        schedule.start_time = normalizeTime(schedule.start_time);
      }
      if (schedule.changed('end_time')) {
        schedule.end_time = normalizeTime(schedule.end_time);
      }
    }
  }
});

// Функция для нормализации времени
function normalizeTime(timeString) {
  if (typeof timeString !== 'string') return timeString;
  
  // Если время в формате HH:MM, добавляем секунды
  if (timeString.match(/^\d{2}:\d{2}$/)) {
    return timeString + ':00';
  }
  
  return timeString;
}

// Методы экземпляра
Schedule.prototype.toJSON = function() {
  const values = { ...this.get() };
  
  // Добавляем читаемое название дня недели
  values.day_name = WEEKDAY_NAMES[values.day_of_week];
  
  // Форматируем время для отображения (убираем секунды)
  if (values.start_time) {
    values.start_time_display = values.start_time.substring(0, 5);
  }
  if (values.end_time) {
    values.end_time_display = values.end_time.substring(0, 5);
  }
  
  return values;
};

// Получить продолжительность урока в минутах
Schedule.prototype.getDurationMinutes = function() {
  if (!this.start_time || !this.end_time) return 0;
  
  const [startHours, startMinutes] = this.start_time.split(':').map(Number);
  const [endHours, endMinutes] = this.end_time.split(':').map(Number);
  
  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;
  
  return endTotalMinutes - startTotalMinutes;
};

// Проверить происходит ли урок в указанное время
Schedule.prototype.isActiveAt = function(dayOfWeek, currentTime) {
  if (this.day_of_week !== dayOfWeek) return false;
  
  const currentTimeStr = currentTime.toTimeString().substring(0, 8);
  return currentTimeStr >= this.start_time && currentTimeStr <= this.end_time;
};

// Статические методы
Schedule.findByGroup = function(groupId) {
  return this.findAll({
    where: {
      group_id: groupId
    },
    order: [['day_of_week', 'ASC'], ['start_time', 'ASC']]
  });
};

Schedule.findByDay = function(dayOfWeek) {
  return this.findAll({
    where: {
      day_of_week: dayOfWeek
    },
    order: [['start_time', 'ASC']]
  });
};

// Найти расписание на сегодня
Schedule.findForToday = function() {
  const today = new Date();
  const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay(); // Воскресенье = 7
  
  return this.findByDay(dayOfWeek);
};

// Найти группы учителя на сегодня
Schedule.findTodayByTeacher = async function(teacherId) {
  const { Group } = require('./index');
  const today = new Date();
  const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
  
  return this.findAll({
    where: {
      day_of_week: dayOfWeek
    },
    include: [{
      model: Group,
      as: 'group',
      where: {
        teacher_id: teacherId,
        is_active: true
      },
      required: true
    }],
    order: [['start_time', 'ASC']]
  });
};

// Проверить пересечение времени для группы
Schedule.checkTimeConflict = async function(groupId, dayOfWeek, startTime, endTime, excludeId = null) {
  const { Op } = require('sequelize');
  
  const whereClause = {
    group_id: groupId,
    day_of_week: dayOfWeek,
    [Op.or]: [
      // Новое время начинается во время существующего урока
      {
        start_time: { [Op.lte]: startTime },
        end_time: { [Op.gt]: startTime }
      },
      // Новое время заканчивается во время существующего урока
      {
        start_time: { [Op.lt]: endTime },
        end_time: { [Op.gte]: endTime }
      },
      // Новое время полностью покрывает существующий урок
      {
        start_time: { [Op.gte]: startTime },
        end_time: { [Op.lte]: endTime }
      }
    ]
  };
  
  // Исключаем текущую запись при обновлении
  if (excludeId) {
    whereClause.id = { [Op.ne]: excludeId };
  }
  
  const conflictingSchedule = await this.findOne({ where: whereClause });
  return conflictingSchedule !== null;
};

// Получить еженедельное расписание группы
Schedule.getWeeklySchedule = async function(groupId) {
  const schedules = await this.findByGroup(groupId);
  
  const weeklySchedule = {};
  
  // Инициализируем все дни недели
  for (let day = 1; day <= 7; day++) {
    weeklySchedule[day] = {
      day_name: WEEKDAY_NAMES[day],
      lessons: []
    };
  }
  
  // Заполняем расписание
  schedules.forEach(schedule => {
    weeklySchedule[schedule.day_of_week].lessons.push(schedule.toJSON());
  });
  
  return weeklySchedule;
};

module.exports = Schedule;