const { StudentComment, Student, Teacher, Group, Course, User } = require('../models');

const commentController = {
  // GET /api/comments - получить все комментарии (для админа)
  getAllComments: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        student_id,
        teacher_id,
        group_id,
        is_read,
        is_urgent,
        comment_type,
        start_date,
        end_date
      } = req.query;

      const offset = (page - 1) * limit;
      let whereClause = {};

      // Фильтрация
      if (student_id) whereClause.student_id = student_id;
      if (teacher_id) whereClause.teacher_id = teacher_id;
      if (group_id) whereClause.group_id = group_id;
      if (is_read !== undefined) whereClause.is_read = is_read === 'true';
      if (is_urgent !== undefined) whereClause.is_urgent = is_urgent === 'true';
      if (comment_type) whereClause.comment_type = comment_type;

      // Фильтрация по датам
      if (start_date || end_date) {
        const { Op } = require('sequelize');
        whereClause.createdAt = {};
        
        if (start_date) {
          whereClause.createdAt[Op.gte] = start_date;
        }
        if (end_date) {
          whereClause.createdAt[Op.lte] = end_date;
        }
      }

      const { count, rows: comments } = await StudentComment.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Student,
            as: 'student',
            attributes: ['id', 'first_name', 'last_name', 'phone']
          },
          {
            model: Teacher,
            as: 'teacher',
            attributes: ['id', 'first_name', 'last_name'],
            include: [{
              model: User,
              as: 'user',
              attributes: ['login']
            }]
          },
          {
            model: Group,
            as: 'group',
            attributes: ['id', 'name'],
            include: [{
              model: Course,
              as: 'course',
              attributes: ['id', 'name']
            }]
          }
        ],
        order: [
          ['is_urgent', 'DESC'],
          ['is_read', 'ASC'],
          ['createdAt', 'DESC']
        ],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: {
          comments,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(count / limit)
          }
        }
      });
    } catch (error) {
      console.error('Ошибка получения комментариев:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при получении комментариев'
      });
    }
  },

  // GET /api/comments/unread - получить непрочитанные комментарии (для админа)
  getUnreadComments: async (req, res) => {
    try {
      const comments = await StudentComment.findAll({
        where: { is_read: false },
        include: [
          {
            model: Student,
            as: 'student',
            attributes: ['id', 'first_name', 'last_name', 'phone']
          },
          {
            model: Teacher,
            as: 'teacher',
            attributes: ['id', 'first_name', 'last_name'],
            include: [{
              model: User,
              as: 'user',
              attributes: ['login']
            }]
          },
          {
            model: Group,
            as: 'group',
            attributes: ['id', 'name'],
            include: [{
              model: Course,
              as: 'course',
              attributes: ['id', 'name']
            }]
          }
        ],
        order: [
          ['is_urgent', 'DESC'],
          ['createdAt', 'ASC']
        ]
      });

      res.json({
        success: true,
        data: {
          comments,
          count: comments.length,
          urgent_count: comments.filter(c => c.is_urgent).length
        }
      });
    } catch (error) {
      console.error('Ошибка получения непрочитанных комментариев:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при получении непрочитанных комментариев'
      });
    }
  },

  // GET /api/comments/my - получить комментарии текущего учителя
  getMyComments: async (req, res) => {
    try {
      const { page = 1, limit = 20, student_id, group_id } = req.query;
      const offset = (page - 1) * limit;

      // Получаем ID учителя из токена
      const teacher = await Teacher.findOne({
        where: { user_id: req.user.id }
      });

      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: 'Профиль учителя не найден'
        });
      }

      let whereClause = { teacher_id: teacher.id };

      if (student_id) whereClause.student_id = student_id;
      if (group_id) whereClause.group_id = group_id;

      const { count, rows: comments } = await StudentComment.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Student,
            as: 'student',
            attributes: ['id', 'first_name', 'last_name', 'phone']
          },
          {
            model: Group,
            as: 'group',
            attributes: ['id', 'name'],
            include: [{
              model: Course,
              as: 'course',
              attributes: ['id', 'name']
            }]
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: {
          comments,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(count / limit)
          }
        }
      });
    } catch (error) {
      console.error('Ошибка получения комментариев учителя:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при получении ваших комментариев'
      });
    }
  },

  // GET /api/comments/student/:studentId - получить комментарии о студенте
  getStudentComments: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { limit = 10 } = req.query;

      const comments = await StudentComment.findAll({
        where: { student_id: studentId },
        include: [
          {
            model: Teacher,
            as: 'teacher',
            attributes: ['id', 'first_name', 'last_name'],
            include: [{
              model: User,
              as: 'user',
              attributes: ['login']
            }]
          },
          {
            model: Group,
            as: 'group',
            attributes: ['id', 'name'],
            include: [{
              model: Course,
              as: 'course',
              attributes: ['id', 'name']
            }]
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data: comments
      });
    } catch (error) {
      console.error('Ошибка получения комментариев о студенте:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при получении комментариев о студенте'
      });
    }
  },

  // GET /api/comments/stats - получить статистику комментариев (для админа)
  getCommentsStats: async (req, res) => {
    try {
      const { start_date, end_date } = req.query;

      const stats = await StudentComment.getStats(start_date, end_date);
      const teacherStats = await StudentComment.getTeacherStats(start_date, end_date);

      res.json({
        success: true,
        data: {
          general: stats,
          by_teachers: teacherStats
        }
      });
    } catch (error) {
      console.error('Ошибка получения статистики комментариев:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при получении статистики'
      });
    }
  },

  // GET /api/comments/:id - получить комментарий по ID
  getCommentById: async (req, res) => {
    try {
      const { id } = req.params;

      const comment = await StudentComment.findByPk(id, {
        include: [
          {
            model: Student,
            as: 'student',
            attributes: ['id', 'first_name', 'last_name', 'phone']
          },
          {
            model: Teacher,
            as: 'teacher',
            attributes: ['id', 'first_name', 'last_name'],
            include: [{
              model: User,
              as: 'user',
              attributes: ['login']
            }]
          },
          {
            model: Group,
            as: 'group',
            attributes: ['id', 'name'],
            include: [{
              model: Course,
              as: 'course',
              attributes: ['id', 'name']
            }]
          }
        ]
      });

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Комментарий не найден'
        });
      }

      res.json({
        success: true,
        data: comment
      });
    } catch (error) {
      console.error('Ошибка получения комментария:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при получении комментария'
      });
    }
  },

  // POST /api/comments - создать комментарий (только учителя)
  createComment: async (req, res) => {
    try {
      const {
        student_id,
        group_id,
        comment,
        comment_type = 'neutral',
        is_urgent = false,
        lesson_date
      } = req.body;

      // Получаем ID учителя из токена
      const teacher = await Teacher.findOne({
        where: { user_id: req.user.id }
      });

      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: 'Профиль учителя не найден'
        });
      }

      // Проверяем, что студент есть в группе
      const { StudentGroup } = require('../models');
      const studentInGroup = await StudentGroup.findOne({
        where: {
          student_id,
          group_id,
          is_active: true
        }
      });

      if (!studentInGroup) {
        return res.status(400).json({
          success: false,
          message: 'Студент не записан в указанную группу'
        });
      }

      // Проверяем, что учитель ведет эту группу
      const group = await Group.findOne({
        where: {
          id: group_id,
          teacher_id: teacher.id
        }
      });

      if (!group) {
        return res.status(403).json({
          success: false,
          message: 'Вы не можете оставлять комментарии для этой группы'
        });
      }

      const newComment = await StudentComment.create({
        student_id,
        teacher_id: teacher.id,
        group_id,
        comment,
        comment_type,
        is_urgent,
        lesson_date: lesson_date || null
      });

      // Получаем созданный комментарий с связанными данными
      const createdComment = await StudentComment.findByPk(newComment.id, {
        include: [
          {
            model: Student,
            as: 'student',
            attributes: ['id', 'first_name', 'last_name']
          },
          {
            model: Group,
            as: 'group',
            attributes: ['id', 'name'],
            include: [{
              model: Course,
              as: 'course',
              attributes: ['id', 'name']
            }]
          }
        ]
      });

      res.status(201).json({
        success: true,
        message: 'Комментарий успешно создан',
        data: createdComment
      });
    } catch (error) {
      console.error('Ошибка создания комментария:', error);
      
      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Ошибка валидации данных',
          errors: error.errors.map(err => ({
            field: err.path,
            message: err.message
          }))
        });
      }

      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при создании комментария'
      });
    }
  },

  // PUT /api/comments/:id - обновить комментарий (только автор)
  updateComment: async (req, res) => {
    try {
      const { id } = req.params;
      const { comment, comment_type, is_urgent, lesson_date } = req.body;

      const existingComment = await StudentComment.findByPk(id);

      if (!existingComment) {
        return res.status(404).json({
          success: false,
          message: 'Комментарий не найден'
        });
      }

      // Проверяем права доступа
      if (req.user.role === 'teacher') {
        const teacher = await Teacher.findOne({
          where: { user_id: req.user.id }
        });

        if (!teacher || existingComment.teacher_id !== teacher.id) {
          return res.status(403).json({
            success: false,
            message: 'Вы можете редактировать только свои комментарии'
          });
        }
      }

      const updateData = {};
      if (comment) updateData.comment = comment;
      if (comment_type) updateData.comment_type = comment_type;
      if (is_urgent !== undefined) updateData.is_urgent = is_urgent;
      if (lesson_date !== undefined) updateData.lesson_date = lesson_date;

      await existingComment.update(updateData);

      const updatedComment = await StudentComment.findByPk(id, {
        include: [
          {
            model: Student,
            as: 'student',
            attributes: ['id', 'first_name', 'last_name']
          },
          {
            model: Teacher,
            as: 'teacher',
            attributes: ['id', 'first_name', 'last_name']
          },
          {
            model: Group,
            as: 'group',
            attributes: ['id', 'name']
          }
        ]
      });

      res.json({
        success: true,
        message: 'Комментарий успешно обновлен',
        data: updatedComment
      });
    } catch (error) {
      console.error('Ошибка обновления комментария:', error);
      
      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Ошибка валидации данных',
          errors: error.errors.map(err => ({
            field: err.path,
            message: err.message
          }))
        });
      }

      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при обновлении комментария'
      });
    }
  },

  // PATCH /api/comments/:id/mark-read - пометить комментарий как прочитанный (только админы)
  markAsRead: async (req, res) => {
    try {
      const { id } = req.params;
      const { admin_response } = req.body;

      const comment = await StudentComment.findByPk(id);

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Комментарий не найден'
        });
      }

      const updateData = {
        is_read: true
      };

      if (admin_response) {
        updateData.admin_response = admin_response;
        updateData.response_date = new Date();
      }

      await comment.update(updateData);

      const updatedComment = await StudentComment.findByPk(id, {
        include: [
          {
            model: Student,
            as: 'student',
            attributes: ['id', 'first_name', 'last_name']
          },
          {
            model: Teacher,
            as: 'teacher',
            attributes: ['id', 'first_name', 'last_name']
          },
          {
            model: Group,
            as: 'group',
            attributes: ['id', 'name']
          }
        ]
      });

      res.json({
        success: true,
        message: 'Комментарий помечен как прочитанный',
        data: updatedComment
      });
    } catch (error) {
      console.error('Ошибка отметки комментария как прочитанного:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при отметке комментария'
      });
    }
  },

  // PATCH /api/comments/mark-all-read - пометить все комментарии как прочитанные (только админы)
  markAllAsRead: async (req, res) => {
    try {
      const [updatedCount] = await StudentComment.update(
        { is_read: true },
        { 
          where: { is_read: false },
          returning: true
        }
      );

      res.json({
        success: true,
        message: `Помечено как прочитанные ${updatedCount} комментариев`,
        data: { updated_count: updatedCount }
      });
    } catch (error) {
      console.error('Ошибка отметки всех комментариев как прочитанных:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при отметке всех комментариев'
      });
    }
  },

  // DELETE /api/comments/:id - удалить комментарий (только автор или админы)
  deleteComment: async (req, res) => {
    try {
      const { id } = req.params;

      const comment = await StudentComment.findByPk(id);

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Комментарий не найден'
        });
      }

      // Проверяем права доступа
      if (req.user.role === 'teacher') {
        const teacher = await Teacher.findOne({
          where: { user_id: req.user.id }
        });

        if (!teacher || comment.teacher_id !== teacher.id) {
          return res.status(403).json({
            success: false,
            message: 'Вы можете удалять только свои комментарии'
          });
        }
      }

      await comment.destroy();

      res.json({
        success: true,
        message: 'Комментарий успешно удален'
      });
    } catch (error) {
      console.error('Ошибка удаления комментария:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при удалении комментария'
      });
    }
  }
};

module.exports = commentController;