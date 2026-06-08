const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const StudentGroup = sequelize.define('StudentGroup', {
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
  
  joined_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    validate: {
      isDate: {
        msg: 'Дата записи должна быть корректной датой'
      }
    }
  },
  
  first_lesson_attended: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Посетил ли студент первый урок (для запуска автоматического списания)'
  },
  
  first_charge_date: {
    type: DataTypes.DATE,
    allowNull: true,
    validate: {
      isDate: {
        msg: 'Дата первого списания должна быть корректной датой'
      }
    }
  },
  
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Активна ли запись (учится ли студент в этой группе)'
  },
  
  completion_date: {
    type: DataTypes.DATE,
    allowNull: true,
    validate: {
      isDate: {
        msg: 'Дата завершения должна быть корректной датой'
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
  tableName: 'student_groups',
  timestamps: true,
  
  // Индексы для оптимизации
  indexes: [
    {
      unique: true,
      fields: ['student_id', 'group_id'],
      name: 'unique_student_group'
    },
    {
      fields: ['student_id']
    },
    {
      fields: ['group_id']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['first_lesson_attended']
    },
    {
      fields: ['joined_at']
    }
  ],
  
  // Хуки модели
  hooks: {
    beforeCreate: (studentGroup, options) => {
      if (studentGroup.notes) {
        studentGroup.notes = studentGroup.notes.trim();
      }
    },
    
    beforeUpdate: (studentGroup, options) => {
      if (studentGroup.changed('notes') && studentGroup.notes) {
        studentGroup.notes = studentGroup.notes.trim();
      }
      
      // Если студент завершил обучение, устанавливаем дату завершения
      if (studentGroup.changed('is_active') && !studentGroup.is_active && !studentGroup.completion_date) {
        studentGroup.completion_date = new Date();
      }
    }
  }
});

// Методы экземпляра
StudentGroup.prototype.toJSON = function() {
  const values = { ...this.get() };
  return values;
};

// Проверить активна ли запись
StudentGroup.prototype.isActive = function() {
  return this.is_active;
};

// Проверить начато ли автоматическое списание
StudentGroup.prototype.isChargingStarted = function() {
  return this.first_lesson_attended && this.first_charge_date !== null;
};

// Получить количество дней в группе
StudentGroup.prototype.getDaysInGroup = function() {
  const startDate = new Date(this.joined_at);
  const endDate = this.completion_date ? new Date(this.completion_date) : new Date();
  const diffTime = Math.abs(endDate - startDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Статические методы
StudentGroup.findByStudent = function(studentId) {
  return this.findAll({
    where: {
      student_id: studentId
    },
    order: [['joined_at', 'DESC']]
  });
};

StudentGroup.findActiveByStudent = function(studentId) {
  return this.findAll({
    where: {
      student_id: studentId,
      is_active: true
    },
    order: [['joined_at', 'DESC']]
  });
};

StudentGroup.findByGroup = function(groupId) {
  return this.findAll({
    where: {
      group_id: groupId
    },
    order: [['joined_at', 'ASC']]
  });
};

StudentGroup.findActiveByGroup = function(groupId) {
  return this.findAll({
    where: {
      group_id: groupId,
      is_active: true
    },
    order: [['joined_at', 'ASC']]
  });
};

// Найти конкретную связь студент-группа
StudentGroup.findByStudentAndGroup = function(studentId, groupId) {
  return this.findOne({
    where: {
      student_id: studentId,
      group_id: groupId
    }
  });
};

// Найти активную связь студент-группа
StudentGroup.findActiveByStudentAndGroup = function(studentId, groupId) {
  return this.findOne({
    where: {
      student_id: studentId,
      group_id: groupId,
      is_active: true
    }
  });
};

// Получить статистику по группе
StudentGroup.getGroupStats = async function(groupId) {
  const { Op } = require('sequelize');
  
  const stats = await this.findAll({
    where: {
      group_id: groupId
    },
    attributes: [
      [sequelize.fn('COUNT', sequelize.col('*')), 'total_enrollments'],
      [sequelize.fn('COUNT', sequelize.literal('CASE WHEN is_active = true THEN 1 END')), 'active_students'],
      [sequelize.fn('COUNT', sequelize.literal('CASE WHEN first_lesson_attended = true THEN 1 END')), 'attended_first_lesson'],
      [sequelize.fn('COUNT', sequelize.literal('CASE WHEN completion_date IS NOT NULL THEN 1 END')), 'completed_students']
    ],
    raw: true
  });
  
  return stats[0] || {
    total_enrollments: 0,
    active_students: 0,
    attended_first_lesson: 0,
    completed_students: 0
  };
};

// Получить статистику по студенту
StudentGroup.getStudentStats = async function(studentId) {
  const stats = await this.findAll({
    where: {
      student_id: studentId
    },
    attributes: [
      [sequelize.fn('COUNT', sequelize.col('*')), 'total_groups'],
      [sequelize.fn('COUNT', sequelize.literal('CASE WHEN is_active = true THEN 1 END')), 'active_groups'],
      [sequelize.fn('COUNT', sequelize.literal('CASE WHEN completion_date IS NOT NULL THEN 1 END')), 'completed_groups']
    ],
    raw: true
  });
  
  return stats[0] || {
    total_groups: 0,
    active_groups: 0,
    completed_groups: 0
  };
};

// Найти студентов которые не посещали первый урок
StudentGroup.findNotAttendedFirstLesson = function(groupId = null) {
  const whereClause = {
    first_lesson_attended: false,
    is_active: true
  };
  
  if (groupId) {
    whereClause.group_id = groupId;
  }
  
  return this.findAll({
    where: whereClause,
    order: [['joined_at', 'ASC']]
  });
};

// Найти студентов готовых к автоматическому списанию
StudentGroup.findReadyForCharging = function(groupId = null) {
  const whereClause = {
    first_lesson_attended: true,
    first_charge_date: null,
    is_active: true
  };
  
  if (groupId) {
    whereClause.group_id = groupId;
  }
  
  return this.findAll({
    where: whereClause,
    order: [['joined_at', 'ASC']]
  });
};

module.exports = StudentGroup;