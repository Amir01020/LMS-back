const { Attendance, Student, Group, Teacher, StudentGroup, Course } = require('../models');
const { HTTP_STATUS, SUCCESS_MESSAGES, ERROR_MESSAGES } = require('../utils/constants');

class AttendanceController {
  
  // GET /api/attendances - получить все записи посещаемости
  static async getAllAttendances(req, res) {
    try {
      const { 
        student_id, 
        group_id, 
        lesson_date, 
        is_present,
        start_date,
        end_date,
        page = 1, 
        limit = 100 
      } = req.query;
      
      let whereClause = {};
      const offset = (page - 1) * limit;
      
      // Фильтры
      if (student_id) whereClause.student_id = student_id;
      if (group_id) whereClause.group_id = group_id;
      if (lesson_date) whereClause.lesson_date = lesson_date;
      if (is_present !== undefined) whereClause.is_present = is_present === 'true';
      
      // Диапазон дат
      if (start_date || end_date) {
        const { Op } = require('sequelize');
        whereClause.lesson_date = {};
        if (start_date) whereClause.lesson_date[Op.gte] = start_date;
        if (end_date) whereClause.lesson_date[Op.lte] = end_date;
      }
      
      const result = await Attendance.findAndCountAll({
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
          },
          {
            model: Teacher,
            as: 'markedByTeacher',
            attributes: ['id', 'first_name', 'last_name']
          }
        ],
        order: [['lesson_date', 'DESC'], ['group_id', 'ASC'], ['student_id', 'ASC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          attendances: result.rows,
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
  
  // GET /api/attendances/group/:groupId/date/:date - получить посещаемость группы за дату
  static async getGroupAttendanceForDate(req, res) {
    try {
      const { groupId, date } = req.params;
      
      // Проверяем существование группы
      const group = await Group.findByPk(groupId);
      if (!group) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.GROUP_NOT_FOUND
        });
      }
      
      const attendances = await Attendance.getGroupAttendanceForDate(groupId, date);
      
      // Добавляем информацию о студентах
      const attendancesWithStudents = await Promise.all(
        attendances.map(async (attendance) => {
          const attendanceData = attendance.toJSON();
          const student = await Student.findByPk(attendance.student_id, {
            attributes: ['id', 'first_name', 'last_name', 'phone', 'status']
          });
          attendanceData.student = student;
          return attendanceData;
        })
      );
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          group: {
            id: group.id,
            name: group.name
          },
          lesson_date: date,
          attendances: attendancesWithStudents,
          count: attendancesWithStudents.length
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
  
  // GET /api/attendances/student/:studentId/stats - получить статистику посещаемости студента
  static async getStudentAttendanceStats(req, res) {
    try {
      const { studentId } = req.params;
      const { start_date, end_date } = req.query;
      
      const student = await Student.findByPk(studentId);
      if (!student) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.STUDENT_NOT_FOUND
        });
      }
      
      const stats = await Attendance.getStudentStats(studentId, start_date, end_date);
      const recentAttendances = await Attendance.findByStudent(studentId, null, null);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          student: {
            id: student.id,
            name: student.getFullName(),
            status: student.status
          },
          stats,
          recent_attendances: recentAttendances.slice(0, 10) // Последние 10 записей
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
  
  // GET /api/attendances/group/:groupId/stats - получить статистику посещаемости группы
  static async getGroupAttendanceStats(req, res) {
    try {
      const { groupId } = req.params;
      const { start_date, end_date } = req.query;
      
      const group = await Group.findByPk(groupId, {
        include: [{
          model: Course,
          as: 'course',
          attributes: ['id', 'name']
        }]
      });
      
      if (!group) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.GROUP_NOT_FOUND
        });
      }
      
      const stats = await Attendance.getGroupStats(groupId, start_date, end_date);
      const lowAttendanceStudents = await Attendance.findLowAttendanceStudents(groupId);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          group: {
            id: group.id,
            name: group.name,
            course: group.course
          },
          stats,
          low_attendance_students: lowAttendanceStudents
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
  
  // POST /api/attendances/mark - отметить посещаемость (массовая операция)
  static async markAttendance(req, res) {
    try {
      const { group_id, lesson_date, attendances } = req.body;
      
      // Валидация обязательных полей
      if (!group_id || !lesson_date || !Array.isArray(attendances)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'ID группы, дата урока и массив посещаемости обязательны'
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
      
      // Находим учителя по user_id
      const teacher = await Teacher.findByUserId(req.user.userId);
      if (!teacher) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Профиль учителя не найден'
        });
      }
      
      const results = [];
      const errors = [];
      
      // Обрабатываем каждую запись посещаемости
      for (const attendance of attendances) {
        try {
          const { student_id, is_present, teacher_comment } = attendance;
          
          if (!student_id || is_present === undefined) {
            errors.push({
              student_id,
              error: 'ID студента и статус присутствия обязательны'
            });
            continue;
          }
          
          // Проверяем что студент записан в группу
          const studentGroup = await StudentGroup.findActiveByStudentAndGroup(student_id, group_id);
          if (!studentGroup) {
            errors.push({
              student_id,
              error: ERROR_MESSAGES.STUDENT_NOT_IN_GROUP
            });
            continue;
          }
          
          // Проверяем не отмечена ли уже посещаемость
          const existingAttendance = await Attendance.findByStudentGroupDate(student_id, group_id, lesson_date);
          
          if (existingAttendance) {
            // Обновляем существующую запись
            await existingAttendance.update({
              is_present,
              teacher_comment: teacher_comment || null,
              marked_at: new Date(),
              marked_by: teacher.id
            });
            results.push(existingAttendance);
          } else {
            // Создаем новую запись
            const newAttendance = await Attendance.create({
              student_id,
              group_id,
              lesson_date,
              is_present,
              teacher_comment: teacher_comment || null,
              marked_at: new Date(),
              marked_by: teacher.id
            });
            results.push(newAttendance);
            
            // Если это первое посещение студента, обновляем StudentGroup
            if (is_present && !studentGroup.first_lesson_attended) {
              await studentGroup.update({
                first_lesson_attended: true,
                first_charge_date: new Date()
              });
            }
          }
          
        } catch (error) {
          errors.push({
            student_id: attendance.student_id,
            error: error.message
          });
        }
      }
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: SUCCESS_MESSAGES.ATTENDANCE_MARKED,
        data: {
          group_id,
          lesson_date,
          processed: results.length,
          errors: errors.length,
          results,
          errors
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
  
  // PUT /api/attendances/:id - обновить запись посещаемости
  static async updateAttendance(req, res) {
    try {
      const { id } = req.params;
      const { is_present, teacher_comment } = req.body;
      
      const attendance = await Attendance.findByPk(id);
      if (!attendance) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Запись посещаемости не найдена'
        });
      }
      
      // Находим учителя по user_id
      const teacher = await Teacher.findByUserId(req.user.userId);
      if (!teacher) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Профиль учителя не найден'
        });
      }
      
      // Обновляем только переданные поля
      const updateData = {
        marked_at: new Date(),
        marked_by: teacher.id
      };
      
      if (is_present !== undefined) updateData.is_present = is_present;
      if (teacher_comment !== undefined) updateData.teacher_comment = teacher_comment;
      
      await attendance.update(updateData);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: SUCCESS_MESSAGES.UPDATED,
        data: {
          attendance
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
  
  // DELETE /api/attendances/:id - удалить запись посещаемости
  static async deleteAttendance(req, res) {
    try {
      const { id } = req.params;
      
      const attendance = await Attendance.findByPk(id);
      if (!attendance) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Запись посещаемости не найдена'
        });
      }
      
      await attendance.destroy();
      
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
  
  // GET /api/attendances/recent - получить недавнюю посещаемость
  static async getRecentAttendance(req, res) {
    try {
      const { days = 7 } = req.query;
      
      const recentAttendances = await Attendance.getRecentAttendance(parseInt(days));
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          attendances: recentAttendances,
          days: parseInt(days),
          count: recentAttendances.length
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
}

module.exports = AttendanceController;