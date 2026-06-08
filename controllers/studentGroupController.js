const { StudentGroup, Student, Group, Course, Teacher } = require('../models');
const { HTTP_STATUS, SUCCESS_MESSAGES, ERROR_MESSAGES } = require('../utils/constants');

class StudentGroupController {
  
  // GET /api/student-groups - получить все записи студент-группа
  static async getAllStudentGroups(req, res) {
    try {
      const { student_id, group_id, active_only, page = 1, limit = 50 } = req.query;
      
      let whereClause = {};
      const offset = (page - 1) * limit;
      
      // Фильтры
      if (student_id) {
        whereClause.student_id = student_id;
      }
      if (group_id) {
        whereClause.group_id = group_id;
      }
      if (active_only === 'true') {
        whereClause.is_active = true;
      }
      
      const result = await StudentGroup.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Student,
            as: 'student',
            attributes: ['id', 'first_name', 'last_name', 'phone', 'status']
          },
          {
            model: Group,
            as: 'group',
            attributes: ['id', 'name', 'is_active'],
            include: [{
              model: Course,
              as: 'course',
              attributes: ['id', 'name', 'price_per_month']
            }]
          }
        ],
        order: [['joined_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          studentGroups: result.rows,
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
  
  // GET /api/student-groups/student/:studentId - получить группы студента
  static async getStudentGroups(req, res) {
    try {
      const { studentId } = req.params;
      const { active_only } = req.query;
      
      // Проверяем существование студента
      const student = await Student.findByPk(studentId);
      if (!student) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.STUDENT_NOT_FOUND
        });
      }
      
      let studentGroups;
      if (active_only === 'true') {
        studentGroups = await StudentGroup.findActiveByStudent(studentId);
      } else {
        studentGroups = await StudentGroup.findByStudent(studentId);
      }
      
      // Добавляем информацию о группах и курсах
      const studentGroupsWithDetails = await Promise.all(
        studentGroups.map(async (sg) => {
          const sgData = sg.toJSON();
          const group = await Group.findByPk(sg.group_id, {
            include: [{
              model: Course,
              as: 'course',
              attributes: ['id', 'name', 'price_per_month']
            }]
          });
          sgData.group = group;
          return sgData;
        })
      );
      
      // Получаем статистику студента
      const stats = await StudentGroup.getStudentStats(studentId);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          student: {
            id: student.id,
            name: student.getFullName(),
            status: student.status
          },
          studentGroups: studentGroupsWithDetails,
          stats,
          count: studentGroupsWithDetails.length
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
  
  // GET /api/student-groups/group/:groupId - получить студентов группы
  static async getGroupStudents(req, res) {
    try {
      const { groupId } = req.params;
      const { active_only } = req.query;
      
      // Проверяем существование группы
      const group = await Group.findByPk(groupId, {
        include: [{
          model: Course,
          as: 'course',
          attributes: ['id', 'name', 'price_per_month']
        }]
      });
      
      if (!group) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.GROUP_NOT_FOUND
        });
      }
      
      let studentGroups;
      if (active_only === 'true') {
        studentGroups = await StudentGroup.findActiveByGroup(groupId);
      } else {
        studentGroups = await StudentGroup.findByGroup(groupId);
      }
      
      // Добавляем информацию о студентах
      const studentGroupsWithDetails = await Promise.all(
        studentGroups.map(async (sg) => {
          const sgData = sg.toJSON();
          const student = await Student.findByPk(sg.student_id);
          sgData.student = student;
          return sgData;
        })
      );
      
      // Получаем статистику группы
      const stats = await StudentGroup.getGroupStats(groupId);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          group: {
            id: group.id,
            name: group.name,
            course: group.course,
            max_students: group.max_students
          },
          studentGroups: studentGroupsWithDetails,
          stats,
          count: studentGroupsWithDetails.length
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
  
  // POST /api/student-groups - записать студента в группу
  static async enrollStudent(req, res) {
    try {
      const { student_id, group_id, notes } = req.body;
      
      // Валидация обязательных полей
      if (!student_id || !group_id) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'ID студента и ID группы обязательны'
        });
      }
      
      // Проверяем существование студента
      const student = await Student.findByPk(student_id);
      if (!student) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.STUDENT_NOT_FOUND
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
      
      // Проверяем активность группы
      if (!group.isActive()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Группа не активна, нельзя записать студента'
        });
      }
      
      // Проверяем может ли студент посещать занятия
      if (!student.canAttend()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Студент не может посещать занятия (статус: ' + student.status + ')'
        });
      }
      
      // Проверяем не записан ли уже студент в эту группу
      const existingEnrollment = await StudentGroup.findActiveByStudentAndGroup(student_id, group_id);
      if (existingEnrollment) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: 'Студент уже записан в эту группу'
        });
      }
      
      // Проверяем не превышен ли лимит студентов в группе
      const currentStudentsCount = await StudentGroup.count({
        where: {
          group_id: group_id,
          is_active: true
        }
      });
      
      if (currentStudentsCount >= group.max_students) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: `Группа полная. Максимум студентов: ${group.max_students}`
        });
      }
      
      // Записываем студента в группу
      const enrollmentData = {
        student_id,
        group_id,
        joined_at: new Date(),
        first_lesson_attended: false,
        first_charge_date: null,
        is_active: true,
        notes: notes || null
      };
      
      const enrollment = await StudentGroup.create(enrollmentData);
      
      // Получаем созданную запись с связями
      const createdEnrollment = await StudentGroup.findByPk(enrollment.id, {
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
              attributes: ['id', 'name', 'price_per_month']
            }]
          }
        ]
      });
      
      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: SUCCESS_MESSAGES.CREATED,
        data: {
          enrollment: createdEnrollment
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
  
  // PATCH /api/student-groups/:id/deactivate - отчислить студента из группы
  static async deactivateEnrollment(req, res) {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      
      const enrollment = await StudentGroup.findByPk(id);
      if (!enrollment) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Запись не найдена'
        });
      }
      
      if (!enrollment.is_active) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Студент уже отчислен из группы'
        });
      }
      
      // Отчисляем студента
      await enrollment.update({
        is_active: false,
        completion_date: new Date(),
        notes: notes || enrollment.notes
      });
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Студент отчислен из группы',
        data: {
          enrollment
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
  
  // PATCH /api/student-groups/:id/reactivate - восстановить студента в группе
  static async reactivateEnrollment(req, res) {
    try {
      const { id } = req.params;
      
      const enrollment = await StudentGroup.findByPk(id);
      if (!enrollment) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Запись не найдена'
        });
      }
      
      if (enrollment.is_active) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Студент уже активен в группе'
        });
      }
      
      // Проверяем лимит студентов в группе
      const currentStudentsCount = await StudentGroup.count({
        where: {
          group_id: enrollment.group_id,
          is_active: true
        }
      });
      
      const group = await Group.findByPk(enrollment.group_id);
      if (currentStudentsCount >= group.max_students) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: `Группа полная. Максимум студентов: ${group.max_students}`
        });
      }
      
      // Восстанавливаем студента
      await enrollment.update({
        is_active: true,
        completion_date: null
      });
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Студент восстановлен в группе',
        data: {
          enrollment
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
  
  // DELETE /api/student-groups/:id - полностью удалить запись
  static async deleteEnrollment(req, res) {
    try {
      const { id } = req.params;
      
      const enrollment = await StudentGroup.findByPk(id);
      if (!enrollment) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Запись не найдена'
        });
      }
      
      // TODO: Проверить есть ли связанные записи посещаемости
      
      await enrollment.destroy();
      
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

module.exports = StudentGroupController;