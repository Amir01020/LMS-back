const { Course } = require('../models');
const { HTTP_STATUS, SUCCESS_MESSAGES, ERROR_MESSAGES } = require('../utils/constants');

class CourseController {
  
  // GET /api/courses - получить все курсы
  static async getAllCourses(req, res) {
    try {
      const { active_only } = req.query;
      
      let courses;
      if (active_only === 'true') {
        courses = await Course.findActive();
      } else {
        courses = await Course.findAll({
          order: [['name', 'ASC']]
        });
      }
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          courses,
          count: courses.length
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
  
  // GET /api/courses/:id - получить курс по ID
  static async getCourseById(req, res) {
    try {
      const { id } = req.params;
      
      const course = await Course.findByPk(id);
      if (!course) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Курс не найден'
        });
      }
      
      // Получаем статистику курса
      const stats = await course.getStats();
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          course: stats
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
  
  // POST /api/courses - создать новый курс
  static async createCourse(req, res) {
    try {
      const { name, description, price_per_month, duration_months, is_active } = req.body;
      
      // Валидация обязательных полей
      if (!name || !price_per_month || !duration_months) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Название, цена и продолжительность курса обязательны'
        });
      }
      
      // Проверяем не существует ли курс с таким названием
      const existingCourse = await Course.findByName(name);
      if (existingCourse) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: 'Курс с таким названием уже существует'
        });
      }
      
      // Создаем курс
      const courseData = {
        name,
        description: description || null,
        price_per_month,
        duration_months,
        is_active: is_active !== undefined ? is_active : true
      };
      
      const course = await Course.create(courseData);
      
      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: SUCCESS_MESSAGES.CREATED,
        data: {
          course
        }
      });
      
    } catch (error) {
      // Обработка ошибок валидации Sequelize
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
  
  // PUT /api/courses/:id - обновить курс
  static async updateCourse(req, res) {
    try {
      const { id } = req.params;
      const { name, description, price_per_month, duration_months, is_active } = req.body;
      
      const course = await Course.findByPk(id);
      if (!course) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Курс не найден'
        });
      }
      
      // Если меняется название, проверяем уникальность
      if (name && name !== course.name) {
        const existingCourse = await Course.findByName(name);
        if (existingCourse) {
          return res.status(HTTP_STATUS.CONFLICT).json({
            success: false,
            message: 'Курс с таким названием уже существует'
          });
        }
      }
      
      // Обновляем только переданные поля
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (price_per_month !== undefined) updateData.price_per_month = price_per_month;
      if (duration_months !== undefined) updateData.duration_months = duration_months;
      if (is_active !== undefined) updateData.is_active = is_active;
      
      await course.update(updateData);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: SUCCESS_MESSAGES.UPDATED,
        data: {
          course
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
  
  // DELETE /api/courses/:id - удалить курс
  static async deleteCourse(req, res) {
    try {
      const { id } = req.params;
      
      const course = await Course.findByPk(id);
      if (!course) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Курс не найден'
        });
      }
      
      // TODO: Проверить есть ли связанные группы/студенты
      // Пока просто удаляем
      
      await course.destroy();
      
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
  
  // PATCH /api/courses/:id/toggle-status - переключить статус активности
  static async toggleCourseStatus(req, res) {
    try {
      const { id } = req.params;
      
      const course = await Course.findByPk(id);
      if (!course) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Курс не найден'
        });
      }
      
      await course.update({
        is_active: !course.is_active
      });
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: `Курс ${course.is_active ? 'активирован' : 'деактивирован'}`,
        data: {
          course
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

module.exports = CourseController;