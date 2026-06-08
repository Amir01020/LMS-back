const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const StudentComment = sequelize.define('StudentComment', {
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
  
  teacher_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'teachers',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    validate: {
      notEmpty: {
        msg: 'ID учителя обязателен'
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
    },
    comment: 'В какой группе был оставлен комментарий'
  },
  
  comment: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Комментарий не может быть пустым'
      },
      len: {
        args: [5, 1000],
        msg: 'Комментарий должен содержать от 5 до 1000 символов'
      }
    }
  },
  
  comment_type: {
    type: DataTypes.ENUM('positive', 'neutral', 'negative', 'warning'),
    allowNull: false,
    defaultValue: 'neutral',
    validate: {
      isIn: {
        args: [['positive', 'neutral', 'negative', 'warning']],
        msg: 'Недопустимый тип комментария'
      }
    }
  },
  
  is_read: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Прочитал ли админ комментарий'
  },
  
  is_urgent: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Требует немедленного внимания админа'
  },
  
  lesson_date: {
    type: DataTypes.DATE,
    allowNull: true,
    validate: {
      isDate: {
        msg: 'Дата урока должна быть корректной датой'
      }
    },
    comment: 'Дата урока, к которому относится комментарий'
  },
  
  admin_response: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: {
        args: [0, 500],
        msg: 'Ответ админа не может превышать 500 символов'
      }
    },
    comment: 'Ответ или действия админа по комментарию'
  },
  
  response_date: {
    type: DataTypes.DATE,
    allowNull: true,
    validate: {
      isDate: {
        msg: 'Дата ответа должна быть корректной датой'
      }
    }
  }
}, {
  tableName: 'student_comments',
  timestamps: true,
  
  // Индексы для оптимизации
  indexes: [
    {
      fields: ['student_id']
    },
    {
      fields: ['teacher_id']
    },
    {
      fields: ['group_id']
    },
    {
      fields: ['is_read']
    },
    {
      fields: ['is_urgent']
    },
    {
      fields: ['comment_type']
    },
    {
      fields: ['lesson_date']
    },
    {
      fields: ['student_id', 'teacher_id'] // Для поиска комментариев конкретного учителя о студенте
    },
    {
      fields: ['is_read', 'is_urgent'] // Для админа - непрочитанные и срочные
    },
    {
      fields: ['group_id', 'lesson_date'] // Для комментариев по группе и дате
    }
  ],
  
  // Хуки модели
  hooks: {
    beforeCreate: (comment, options) => {
      if (comment.comment) {
        comment.comment = comment.comment.trim();
      }
      if (comment.admin_response) {
        comment.admin_response = comment.admin_response.trim();
      }
    },
    
    beforeUpdate: (comment, options) => {
      if (comment.changed('comment') && comment.comment) {
        comment.comment = comment.comment.trim();
      }
      if (comment.changed('admin_response') && comment.admin_response) {
        comment.admin_response = comment.admin_response.trim();
      }
      
      // Если админ отвечает, автоматически помечаем как прочитанное
      if (comment.changed('admin_response') && comment.admin_response && !comment.response_date) {
        comment.response_date = new Date();
        comment.is_read = true;
      }
    }
  }
});

// Методы экземпляра
StudentComment.prototype.toJSON = function() {
  const values = { ...this.get() };
  return values;
};

// Проверить является ли комментарий срочным
StudentComment.prototype.isUrgent = function() {
  return this.is_urgent === true;
};

// Проверить прочитан ли комментарий
StudentComment.prototype.isRead = function() {
  return this.is_read === true;
};

// Получить цвет для типа комментария (для фронтенда)
StudentComment.prototype.getTypeColor = function() {
  const colors = {
    positive: 'green',
    neutral: 'blue',
    negative: 'red',
    warning: 'orange'
  };
  return colors[this.comment_type] || 'gray';
};

// Получить читаемый тип комментария
StudentComment.prototype.getTypeLabel = function() {
  const labels = {
    positive: 'Положительный',
    neutral: 'Нейтральный',
    negative: 'Негативный',
    warning: 'Предупреждение'
  };
  return labels[this.comment_type] || this.comment_type;
};

// Статические методы
StudentComment.findByStudent = function(studentId, limit = null) {
  const options = {
    where: { student_id: studentId },
    order: [['createdAt', 'DESC']]
  };
  
  if (limit) {
    options.limit = limit;
  }
  
  return this.findAll(options);
};

StudentComment.findByTeacher = function(teacherId, limit = null) {
  const options = {
    where: { teacher_id: teacherId },
    order: [['createdAt', 'DESC']]
  };
  
  if (limit) {
    options.limit = limit;
  }
  
  return this.findAll(options);
};

StudentComment.findByGroup = function(groupId, lessonDate = null) {
  let whereClause = { group_id: groupId };
  
  if (lessonDate) {
    whereClause.lesson_date = lessonDate;
  }
  
  return this.findAll({
    where: whereClause,
    order: [['createdAt', 'DESC']]
  });
};

// Получить непрочитанные комментарии для админа
StudentComment.findUnread = function() {
  return this.findAll({
    where: { is_read: false },
    order: [
      ['is_urgent', 'DESC'], // Сначала срочные
      ['createdAt', 'ASC']   // Затем по дате создания (старые первыми)
    ]
  });
};

// Получить срочные комментарии
StudentComment.findUrgent = function() {
  return this.findAll({
    where: { is_urgent: true, is_read: false },
    order: [['createdAt', 'ASC']]
  });
};

// Получить статистику комментариев по типам
StudentComment.getStats = async function(startDate = null, endDate = null) {
  const { Op } = require('sequelize');
  
  let whereClause = {};
  
  if (startDate && endDate) {
    whereClause.createdAt = {
      [Op.between]: [startDate, endDate]
    };
  } else if (startDate) {
    whereClause.createdAt = {
      [Op.gte]: startDate
    };
  } else if (endDate) {
    whereClause.createdAt = {
      [Op.lte]: endDate
    };
  }
  
  const stats = await this.findAll({
    where: whereClause,
    attributes: [
      [sequelize.fn('COUNT', sequelize.col('*')), 'total_comments'],
      [sequelize.fn('COUNT', sequelize.literal('CASE WHEN comment_type = "positive" THEN 1 END')), 'positive_comments'],
      [sequelize.fn('COUNT', sequelize.literal('CASE WHEN comment_type = "neutral" THEN 1 END')), 'neutral_comments'],
      [sequelize.fn('COUNT', sequelize.literal('CASE WHEN comment_type = "negative" THEN 1 END')), 'negative_comments'],
      [sequelize.fn('COUNT', sequelize.literal('CASE WHEN comment_type = "warning" THEN 1 END')), 'warning_comments'],
      [sequelize.fn('COUNT', sequelize.literal('CASE WHEN is_urgent = true THEN 1 END')), 'urgent_comments'],
      [sequelize.fn('COUNT', sequelize.literal('CASE WHEN is_read = false THEN 1 END')), 'unread_comments'],
      [sequelize.fn('COUNT', sequelize.literal('DISTINCT student_id')), 'students_with_comments'],
      [sequelize.fn('COUNT', sequelize.literal('DISTINCT teacher_id')), 'teachers_with_comments']
    ],
    raw: true
  });
  
  const result = stats[0] || {
    total_comments: 0,
    positive_comments: 0,
    neutral_comments: 0,
    negative_comments: 0,
    warning_comments: 0,
    urgent_comments: 0,
    unread_comments: 0,
    students_with_comments: 0,
    teachers_with_comments: 0
  };
  
  // Конвертируем в числа
  Object.keys(result).forEach(key => {
    result[key] = parseInt(result[key]) || 0;
  });
  
  return result;
};

// Получить статистику комментариев по учителям
StudentComment.getTeacherStats = async function(startDate = null, endDate = null) {
  const { Op } = require('sequelize');
  const { Teacher, User } = require('./index');
  
  let whereClause = {};
  
  if (startDate && endDate) {
    whereClause.createdAt = {
      [Op.between]: [startDate, endDate]
    };
  }
  
  return this.findAll({
    where: whereClause,
    include: [{
      model: Teacher,
      as: 'teacher',
      attributes: ['id', 'first_name', 'last_name'],
      include: [{
        model: User,
        as: 'user',
        attributes: ['login']
      }]
    }],
    attributes: [
      'teacher_id',
      [sequelize.fn('COUNT', sequelize.col('*')), 'total_comments'],
      [sequelize.fn('COUNT', sequelize.literal('CASE WHEN comment_type = "positive" THEN 1 END')), 'positive_count'],
      [sequelize.fn('COUNT', sequelize.literal('CASE WHEN comment_type = "negative" THEN 1 END')), 'negative_count'],
      [sequelize.fn('COUNT', sequelize.literal('CASE WHEN is_urgent = true THEN 1 END')), 'urgent_count'],
      [sequelize.fn('COUNT', sequelize.literal('DISTINCT student_id')), 'unique_students']
    ],
    group: ['teacher_id'],
    order: [[sequelize.literal('total_comments'), 'DESC']]
  });
};

// Пометить комментарий как прочитанный
StudentComment.markAsRead = async function(commentId, adminResponse = null) {
  const comment = await this.findByPk(commentId);
  if (!comment) {
    throw new Error('Комментарий не найден');
  }
  
  const updateData = {
    is_read: true
  };
  
  if (adminResponse) {
    updateData.admin_response = adminResponse;
    updateData.response_date = new Date();
  }
  
  return comment.update(updateData);
};

// Пометить все комментарии как прочитанные
StudentComment.markAllAsRead = function() {
  return this.update(
    { is_read: true },
    { where: { is_read: false } }
  );
};

module.exports = StudentComment;