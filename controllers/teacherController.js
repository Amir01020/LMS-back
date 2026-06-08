const { Teacher, User } = require('../models');
const AuthService = require('../services/authService');
const { HTTP_STATUS, SUCCESS_MESSAGES, ERROR_MESSAGES, USER_ROLES } = require('../utils/constants');

class TeacherController {
  
  // GET /api/teachers - получить всех учителей
  static async getAllTeachers(req, res) {
    try {
      const { active_only, search, page = 1, limit = 50 } = req.query;
      
      let teachers;
      const offset = (page - 1) * limit;
      
      if (search) {
        // Поиск по имени
        teachers = await Teacher.searchByName(search);
      } else if (active_only === 'true') {
        // Только активные учителя
        teachers = await Teacher.findActive();
      } else {
        // Все учителя с пагинацией
        const result = await Teacher.findAndCountAll({
          include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'login', 'role'],
            required: true
          }],
          order: [['last_name', 'ASC'], ['first_name', 'ASC']],
          limit: parseInt(limit),
          offset: parseInt(offset)
        });
        
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          data: {
            teachers: result.rows,
            pagination: {
              total: result.count,
              page: parseInt(page),
              limit: parseInt(limit),
              pages: Math.ceil(result.count / limit)
            }
          }
        });
      }
      
      // Для поиска и активных учителей добавляем информацию о пользователе
      const teachersWithUser = await Promise.all(
        teachers.map(async (teacher) => {
          const teacherData = teacher.toJSON();
          const user = await User.findByPk(teacher.user_id, {
            attributes: ['id', 'login', 'role']
          });
          teacherData.user = user;
          return teacherData;
        })
      );
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          teachers: teachersWithUser,
          count: teachersWithUser.length
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
  
  // GET /api/teachers/active - получить активных учителей
  static async getActiveTeachers(req, res) {
    try {
      const activeTeachers = await Teacher.findActive();
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          teachers: activeTeachers,
          count: activeTeachers.length
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
  
  // GET /api/teachers/:id - получить учителя по ID
  static async getTeacherById(req, res) {
    try {
      const { id } = req.params;
      
      const teacher = await Teacher.findByPk(id, {
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'login', 'role']
        }]
      });
      
      if (!teacher) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Учитель не найден'
        });
      }
      
      // Получаем статистику учителя
      const stats = await teacher.getStats();
      const teacherData = teacher.toJSON();
      teacherData.stats = stats;
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          teacher: teacherData
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
  
  // GET /api/teachers/my-profile - получить профиль текущего учителя
  static async getMyProfile(req, res) {
    try {
      const teacher = await Teacher.findByUserId(req.user.userId);
      
      if (!teacher) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Профиль учителя не найден'
        });
      }
      
      const stats = await teacher.getStats();
      const teacherData = teacher.toJSON();
      teacherData.stats = stats;
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          teacher: teacherData
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
  
  // POST /api/teachers - создать нового учителя
  static async createTeacher(req, res) {
    try {
      const {
        login,
        password,
        first_name,
        last_name,
        middle_name,
        phone,
        photo,
        specialization,
        experience_years,
        salary_per_student,
        notes
      } = req.body;
      
      // Валидация обязательных полей
      if (!login || !password || !first_name || !last_name || !phone) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Логин, пароль, имя, фамилия и телефон обязательны'
        });
      }
      
      // Проверяем не существует ли учитель с таким телефоном
      const existingTeacher = await Teacher.findByPhone(phone);
      if (existingTeacher) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: 'Учитель с таким номером телефона уже существует'
        });
      }
      
      // Создаем пользователя для учителя
      const userData = {
        login,
        password,
        role: USER_ROLES.TEACHER
      };
      
      const user = await AuthService.createUser(userData);
      
      // Создаем профиль учителя
      const teacherData = {
        user_id: user.id,
        first_name,
        last_name,
        middle_name: middle_name || null,
        phone,
        photo: photo || null,
        specialization: specialization || null,
        experience_years: experience_years || null,
        salary_per_student: salary_per_student || null,
        notes: notes || null,
        hire_date: new Date(),
        is_active: true
      };
      
      const teacher = await Teacher.create(teacherData);
      
      // Получаем учителя с информацией о пользователе
      const createdTeacher = await Teacher.findByPk(teacher.id, {
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'login', 'role']
        }]
      });
      
      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: SUCCESS_MESSAGES.CREATED,
        data: {
          teacher: createdTeacher
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
  
  // PUT /api/teachers/:id - обновить учителя
  static async updateTeacher(req, res) {
    try {
      const { id } = req.params;
      const {
        first_name,
        last_name,
        middle_name,
        phone,
        photo,
        specialization,
        experience_years,
        salary_per_student,
        notes
      } = req.body;
      
      const teacher = await Teacher.findByPk(id);
      if (!teacher) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Учитель не найден'
        });
      }
      
      // Если меняется телефон, проверяем уникальность
      if (phone && phone !== teacher.phone) {
        const existingTeacher = await Teacher.findByPhone(phone);
        if (existingTeacher) {
          return res.status(HTTP_STATUS.CONFLICT).json({
            success: false,
            message: 'Учитель с таким номером телефона уже существует'
          });
        }
      }
      
      // Обновляем только переданные поля
      const updateData = {};
      if (first_name !== undefined) updateData.first_name = first_name;
      if (last_name !== undefined) updateData.last_name = last_name;
      if (middle_name !== undefined) updateData.middle_name = middle_name;
      if (phone !== undefined) updateData.phone = phone;
      if (photo !== undefined) updateData.photo = photo;
      if (specialization !== undefined) updateData.specialization = specialization;
      if (experience_years !== undefined) updateData.experience_years = experience_years;
      if (salary_per_student !== undefined) updateData.salary_per_student = salary_per_student;
      if (notes !== undefined) updateData.notes = notes;
      
      await teacher.update(updateData);
      
      // Получаем обновленного учителя с пользователем
      const updatedTeacher = await Teacher.findByPk(id, {
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'login', 'role']
        }]
      });
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: SUCCESS_MESSAGES.UPDATED,
        data: {
          teacher: updatedTeacher
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
  
  // PATCH /api/teachers/:id/toggle-status - переключить активность учителя
  static async toggleTeacherStatus(req, res) {
    try {
      const { id } = req.params;
      
      const teacher = await Teacher.findByPk(id);
      if (!teacher) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Учитель не найден'
        });
      }
      
      await teacher.update({
        is_active: !teacher.is_active
      });
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: `Учитель ${teacher.is_active ? 'активирован' : 'деактивирован'}`,
        data: {
          teacher
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
  
  // DELETE /api/teachers/:id - удалить учителя
  static async deleteTeacher(req, res) {
    try {
      const { id } = req.params;
      
      const teacher = await Teacher.findByPk(id);
      if (!teacher) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Учитель не найден'
        });
      }
      
      // TODO: Проверить есть ли связанные группы
      
      // Удаляем учителя (пользователь удалится автоматически через CASCADE)
      await teacher.destroy();
      
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

module.exports = TeacherController;