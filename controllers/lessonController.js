const { Op } = require('sequelize');
const {
  Lesson, LessonRecurrence, LessonVideo, LessonMaterial, LessonComment,
  Group, Direction, User, Attendance
} = require('../models');
const GroupAccessService = require('../services/groupAccessService');
const NotificationService = require('../services/notificationService');
const { NOTIFICATION_TYPES, USER_ROLES, HTTP_STATUS } = require('../utils/constants');
const { sendSuccess, sendError } = require('../utils/response');
const { getCurrentWeekRange, getTodayKey } = require('../utils/dateHelpers');

class LessonController {
  static async list(req, res) {
    try {
      const {
        group_id,
        date,
        status,
        mentor_id,
        direction_id,
        date_from,
        date_to,
        period
      } = req.query;

      const where = {};

      if (group_id) where.group_id = group_id;
      if (status) where.status = status;
      if (mentor_id) where.mentor_id = mentor_id;

      if (period === 'current_week') {
        const { monday, sunday } = getCurrentWeekRange();
        where.date = { [Op.between]: [monday, sunday] };
      } else if (period === 'past') {
        const { monday } = getCurrentWeekRange();
        where.date = { [Op.lt]: monday };
      } else if (date) {
        where.date = date;
      } else if (date_from && date_to) {
        where.date = { [Op.between]: [date_from, date_to] };
      } else if (date_from) {
        where.date = { [Op.gte]: date_from };
      } else if (date_to) {
        where.date = { [Op.lte]: date_to };
      }

      const accessFilter = await GroupAccessService.getAccessibleGroupFilter(req.user);
      if (accessFilter.id !== undefined) {
        const allowedGroupIds = Array.isArray(accessFilter.id)
          ? accessFilter.id
          : [accessFilter.id];

        if (group_id) {
          if (!allowedGroupIds.includes(Number(group_id))) {
            return sendSuccess(res, { lessons: [] });
          }
        } else {
          where.group_id = { [Op.in]: allowedGroupIds };
        }
      }

      const groupWhere = {};
      if (direction_id) groupWhere.direction_id = direction_id;

      const lessons = await Lesson.findAll({
        where,
        include: [
          {
            model: Group,
            as: 'group',
            where: Object.keys(groupWhere).length ? groupWhere : undefined,
            required: !!direction_id,
            include: [{ model: Direction, as: 'direction' }]
          },
          { model: User, as: 'mentor', attributes: ['id', 'name', 'email'] }
        ],
        order: [['date', 'ASC'], ['start_time', 'ASC']]
      });

      return sendSuccess(res, { lessons });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async create(req, res) {
    try {
      const {
        group_id, mentor_id, title, description, date, start_time, end_time,
        type, conference_url, status, recurrence
      } = req.body;

      if (!group_id || !mentor_id || !title || !date || !start_time || !end_time) {
        return sendError(res, 'Обязательные поля: group_id, mentor_id, title, date, start_time, end_time', HTTP_STATUS.BAD_REQUEST);
      }

      const lesson = await Lesson.create({
        group_id, mentor_id, title, description, date, start_time, end_time,
        type, conference_url, status
      });

      if (recurrence) {
        await LessonRecurrence.create({
          lesson_id: lesson.id,
          pattern: recurrence.pattern,
          until_date: recurrence.until_date
        });
      }

      const group = await Group.findByPk(group_id, {
        include: [{ model: User, as: 'students', attributes: ['id'] }]
      });

      if (group?.students?.length) {
        await NotificationService.createForUsers(
          group.students.map((s) => s.id),
          NOTIFICATION_TYPES.LESSON_CHANGED,
          'Новый урок',
          `Запланирован урок: ${title}`,
          lesson.id,
          'lesson'
        );
      }

      return sendSuccess(res, { lesson }, 'Урок создан', HTTP_STATUS.CREATED);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async getById(req, res) {
    try {
      const canAccess = await GroupAccessService.canAccessLesson(req.user, req.params.id);
      if (!canAccess) return sendError(res, 'Доступ запрещен', HTTP_STATUS.FORBIDDEN);

      const lesson = await Lesson.findByPk(req.params.id, {
        include: [
          { model: Group, as: 'group', include: [{ model: Direction, as: 'direction' }] },
          { model: User, as: 'mentor', attributes: ['id', 'name', 'email'] },
          { model: LessonVideo, as: 'videos' },
          { model: LessonMaterial, as: 'materials' },
          { model: LessonComment, as: 'comments', include: [{ model: User, as: 'author', attributes: ['id', 'name'] }] },
          { model: Attendance, as: 'attendances', include: [{ model: User, as: 'student', attributes: ['id', 'name'] }] }
        ]
      });

      if (!lesson) return sendError(res, 'Урок не найден', HTTP_STATUS.NOT_FOUND);
      return sendSuccess(res, { lesson });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async update(req, res) {
    try {
      const lesson = await Lesson.findByPk(req.params.id, {
        include: [{ model: Group, as: 'group', include: [{ model: User, as: 'students' }] }]
      });
      if (!lesson) return sendError(res, 'Урок не найден', HTTP_STATUS.NOT_FOUND);

      const { date } = req.body;
      if (date && lesson.status === 'scheduled' && date < getTodayKey()) {
        return sendError(res, 'Нельзя перенести урок на прошедшую дату', HTTP_STATUS.BAD_REQUEST);
      }

      await lesson.update(req.body);

      if (lesson.group?.students?.length) {
        await NotificationService.createForUsers(
          lesson.group.students.map((s) => s.id),
          NOTIFICATION_TYPES.LESSON_CHANGED,
          'Изменение расписания',
          `Урок "${lesson.title}" изменен`,
          lesson.id,
          'lesson'
        );
      }

      return sendSuccess(res, { lesson }, 'Урок обновлен');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async remove(req, res) {
    try {
      const lesson = await Lesson.findByPk(req.params.id);
      if (!lesson) return sendError(res, 'Урок не найден', HTTP_STATUS.NOT_FOUND);
      await lesson.update({ status: 'cancelled' });
      return sendSuccess(res, { lesson }, 'Урок отменен');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async uploadVideo(req, res) {
    try {
      const { video_url, duration } = req.body;
      if (!video_url) return sendError(res, 'video_url обязателен', HTTP_STATUS.BAD_REQUEST);

      const video = await LessonVideo.create({
        lesson_id: req.params.id,
        video_url,
        duration,
        uploaded_by: req.user.userId,
        status: 'available'
      });

      return sendSuccess(res, { video }, 'Видео загружено', HTTP_STATUS.CREATED);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async getVideo(req, res) {
    try {
      const canAccess = await GroupAccessService.canAccessLesson(req.user, req.params.id);
      if (!canAccess) return sendError(res, 'Доступ запрещен', HTTP_STATUS.FORBIDDEN);

      const videos = await LessonVideo.findAll({
        where: { lesson_id: req.params.id },
        include: [{ model: User, as: 'uploader', attributes: ['id', 'name'] }]
      });

      return sendSuccess(res, { videos });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async addMaterial(req, res) {
    try {
      const { title, file_url, type } = req.body;
      const material = await LessonMaterial.create({
        lesson_id: req.params.id,
        title,
        file_url,
        type
      });
      return sendSuccess(res, { material }, 'Материал добавлен', HTTP_STATUS.CREATED);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async getComments(req, res) {
    try {
      const canAccess = await GroupAccessService.canAccessLesson(req.user, req.params.id);
      if (!canAccess) return sendError(res, 'Доступ запрещен', HTTP_STATUS.FORBIDDEN);

      const comments = await LessonComment.findAll({
        where: { lesson_id: req.params.id, parent_id: null },
        include: [
          { model: User, as: 'author', attributes: ['id', 'name', 'role'] },
          {
            model: LessonComment,
            as: 'replies',
            include: [{ model: User, as: 'author', attributes: ['id', 'name', 'role'] }]
          }
        ],
        order: [['created_at', 'DESC']]
      });

      return sendSuccess(res, { comments });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async addComment(req, res) {
    try {
      if (req.user.role === USER_ROLES.STUDENT) {
        return sendError(res, 'Студенты не могут оставлять комментарии', HTTP_STATUS.FORBIDDEN);
      }

      const { text, parent_id } = req.body;
      if (!text) return sendError(res, 'Текст комментария обязателен', HTTP_STATUS.BAD_REQUEST);

      const comment = await LessonComment.create({
        lesson_id: req.params.id,
        author_id: req.user.userId,
        text,
        parent_id: parent_id || null
      });

      const full = await LessonComment.findByPk(comment.id, {
        include: [{ model: User, as: 'author', attributes: ['id', 'name'] }]
      });

      return sendSuccess(res, { comment: full }, 'Комментарий добавлен', HTTP_STATUS.CREATED);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async markAttendance(req, res) {
    try {
      const { student_id, is_present } = req.body;
      const [record] = await Attendance.findOrCreate({
        where: { lesson_id: req.params.id, student_id },
        defaults: { is_present: !!is_present }
      });
      if (!record.isNewRecord) {
        await record.update({ is_present: !!is_present });
      }
      return sendSuccess(res, { attendance: record }, 'Посещаемость отмечена');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }
}

module.exports = LessonController;
