const { Schedule, Group, Course, Teacher } = require('../models');
const { HTTP_STATUS, SUCCESS_MESSAGES, ERROR_MESSAGES, WEEKDAY_NAMES } = require('../utils/constants');

class ScheduleController {
  
  // GET /api/schedules - получить все расписания
  static async getAllSchedules(req, res) {
    try {
      const { group_id, day_of_week, page = 1, limit = 100 } = req.query;
      
      let whereClause = {};
      const offset = (page - 1) * limit;
      
      // Фильтры
      if (group_id) {
        whereClause.group_id = group_id;
      }
      if (day_of_week) {
        whereClause.day_of_week = day_of_week;
      }
      
      const result = await Schedule.findAndCountAll({
        where: whereClause,
        include: [{
          model: Group,
          as: 'group',
          attributes: ['id', 'name', 'room'],
          include: [
            {
              model: Course,
              as: 'course',
              attributes: ['id', 'name']
            },
            {
              model: Teacher,
              as: 'teacher',
              attributes: ['id', 'first_name', 'last_name']
            }
          ]
        }],
        order: [['day_of_week', 'ASC'], ['start_time', 'ASC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          schedules: result.rows,
          pagination: {
            total: result.count,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(result.count / limit)
          }
        }
      });
      
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        details: error.message
      });
    }
  }
  
  // GET /api/schedules/today - получить расписание на сегодня
  static async getTodaySchedule(req, res) {
    try {
      const todaySchedules = await Schedule.findForToday();
      
      // Добавляем информацию о группах
      const schedulesWithDetails = await Promise.all(
        todaySchedules.map(async (schedule) => {
          const scheduleData = schedule.toJSON();
          const group = await Group.findByPk(schedule.group_id, {
            include: [
              {
                model: Course,
                as: 'course',
                attributes: ['id', 'name']
              },
              {
                model: Teacher,
                as: 'teacher',
                attributes: ['id', 'first_name', 'last_name']
              }
            ]
          });
          scheduleData.group = group;
          return scheduleData;
        })
      );
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          schedules: schedulesWithDetails,
          count: schedulesWithDetails.length,
          date: new Date().toDateString()
        }
      });
      
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        details: error.message
      });
    }
  }
  
  // GET /api/schedules/my-today - получить расписание текущего учителя на сегодня
  static async getMyTodaySchedule(req, res) {
    try {
      // Находим teacher_id по user_id
      const teacher = await Teacher.findByUserId(req.user.userId);
      if (!teacher) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Профиль учителя не найден'
        });
      }
      
      const todaySchedules = await Schedule.findTodayByTeacher(teacher.id);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          schedules: todaySchedules,
          count: todaySchedules.length,
          date: new Date().toDateString(),
          teacher: {
            id: teacher.id,
            name: teacher.getFullName()
          }
        }
      });
      
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        details: error.message
      });
    }
  }
  
  // GET /api/schedules/group/:groupId - получить расписание группы
  static async getGroupSchedule(req, res) {
    try {
      const { groupId } = req.params;
      const { format = 'list' } = req.query; // 'list' или 'weekly'
      
      // Проверяем существование группы
      const group = await Group.findByPk(groupId);
      if (!group) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.GROUP_NOT_FOUND
        });
      }
      
      if (format === 'weekly') {
        // Возвращаем недельное расписание
        const weeklySchedule = await Schedule.getWeeklySchedule(groupId);
        
        res.status(HTTP_STATUS.OK).json({
          success: true,
          data: {
            group: {
              id: group.id,
              name: group.name
            },
            weekly_schedule: weeklySchedule
          }
        });
      } else {
        // Возвращаем список расписаний
        const schedules = await Schedule.findByGroup(groupId);
        
        res.status(HTTP_STATUS.OK).json({
          success: true,
          data: {
            group: {
              id: group.id,
              name: group.name
            },
            schedules,
            count: schedules.length
          }
        });
      }
      
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        details: error.message
      });
    }
  }
  
  // GET /api/schedules/:id - получить расписание по ID
  static async getScheduleById(req, res) {
    try {
      const { id } = req.params;
      
      const schedule = await Schedule.findByPk(id, {
        include: [{
          model: Group,
          as: 'group',
          include: [
            {
              model: Course,
              as: 'course',
              attributes: ['id', 'name']
            },
            {
              model: Teacher,
              as: 'teacher',
              attributes: ['id', 'first_name', 'last_name']
            }
          ]
        }]
      });
      
      if (!schedule) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Расписание не найдено'
        });
      }
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          schedule
        }
      });
      
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        details: error.message
      });
    }
  }
  
  // POST /api/schedules - создать новое расписание
  static async createSchedule(req, res) {
    try {
      const { group_id, day_of_week, start_time, end_time } = req.body;
      
      // Валидация обязательных полей
      if (!group_id || !day_of_week || !start_time || !end_time) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'ID группы, день недели, время начала и окончания обязательны'
        });
      }
      
      // Проверяем существование группы
      const group = await Group.findByPk(group_id);
      if (!group) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.GROUP_NOT_FOUND
        });
      }
      
      // Проверяем пересечение времени
      const hasConflict = await Schedule.checkTimeConflict(
        group_id, 
        day_of_week, 
        start_time, 
        end_time
      );
      
      if (hasConflict) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: 'Время пересекается с существующим расписанием группы'
        });
      }
      
      // Создаем расписание
      const scheduleData = {
        group_id,
        day_of_week,
        start_time,
        end_time
      };
      
      const schedule = await Schedule.create(scheduleData);
      
      // Получаем созданное расписание с связями
      const createdSchedule = await Schedule.findByPk(schedule.id, {
        include: [{
          model: Group,
          as: 'group',
          attributes: ['id', 'name', 'room']
        }]
      });
      
      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: SUCCESS_MESSAGES.CREATED,
        data: {
          schedule: createdSchedule
        }
      });
      
    } catch (error) {
      if (error.name === 'SequelizeValidationError') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          details: error.errors.map(err => err.message)
        });
      }
      
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        details: error.message
      });
    }
  }
  
  // PUT /api/schedules/:id - обновить расписание
  static async updateSchedule(req, res) {
    try {
      const { id } = req.params;
      const { group_id, day_of_week, start_time, end_time } = req.body;
      
      const schedule = await Schedule.findByPk(id);
      if (!schedule) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Расписание не найдено'
        });
      }
      
      // Если меняется группа, проверяем её существование
      if (group_id && group_id !== schedule.group_id) {
        const group = await Group.findByPk(group_id);
        if (!group) {
          return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: ERROR_MESSAGES.GROUP_NOT_FOUND
          });
        }
      }
      
      // Проверяем пересечение времени (исключая текущую запись)
      const checkGroupId = group_id || schedule.group_id;
      const checkDayOfWeek = day_of_week || schedule.day_of_week;
      const checkStartTime = start_time || schedule.start_time;
      const checkEndTime = end_time || schedule.end_time;
      
      const hasConflict = await Schedule.checkTimeConflict(
        checkGroupId,
        checkDayOfWeek,
        checkStartTime,
        checkEndTime,
        id // Исключаем текущую запись
      );
      
      if (hasConflict) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: 'Время пересекается с существующим расписанием группы'
        });
      }
      
      // Обновляем только переданные поля
      const updateData = {};
      if (group_id !== undefined) updateData.group_id = group_id;
      if (day_of_week !== undefined) updateData.day_of_week = day_of_week;
      if (start_time !== undefined) updateData.start_time = start_time;
      if (end_time !== undefined) updateData.end_time = end_time;
      
      await schedule.update(updateData);
      
      // Получаем обновленное расписание с связями
      const updatedSchedule = await Schedule.findByPk(id, {
        include: [{
          model: Group,
          as: 'group',
          attributes: ['id', 'name', 'room']
        }]
      });
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: SUCCESS_MESSAGES.UPDATED,
        data: {
          schedule: updatedSchedule
        }
      });
      
    } catch (error) {
      if (error.name === 'SequelizeValidationError') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          details: error.errors.map(err => err.message)
        });
      }
      
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        details: error.message
      });
    }
  }
  
  // DELETE /api/schedules/:id - удалить расписание
  static async deleteSchedule(req, res) {
    try {
      const { id } = req.params;
      
      const schedule = await Schedule.findByPk(id);
      if (!schedule) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Расписание не найдено'
        });
      }
      
      await schedule.destroy();
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: SUCCESS_MESSAGES.DELETED
      });
      
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        details: error.message
      });
    }
  }
}

module.exports = ScheduleController;