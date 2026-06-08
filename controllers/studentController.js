const { Student } = require('../models');
const { HTTP_STATUS, SUCCESS_MESSAGES, ERROR_MESSAGES, STUDENT_STATUS } = require('../utils/constants');

class StudentController {
  
  // GET /api/students - получить всех студентов
  static async getAllStudents(req, res) {
    try {
      const { status, search, page = 1, limit = 50 } = req.query;
      
      let students;
      const offset = (page - 1) * limit;
      
      if (search) {
        // Поиск по имени
        students = await Student.searchByName(search);
      } else if (status) {
        // Фильтр по статусу
        students = await Student.findByStatus(status);
      } else {
        // Все студенты с пагинацией
        const result = await Student.findAndCountAll({
          order: [['last_name', 'ASC'], ['first_name', 'ASC']],
          limit: parseInt(limit),
          offset: parseInt(offset)
        });
        
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          data: {
            students: result.rows,
            pagination: {
              total: result.count,
              page: parseInt(page),
              limit: parseInt(limit),
              pages: Math.ceil(result.count / limit)
            }
          }
        });
      }
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          students,
          count: students.length
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
  
  // GET /api/students/debtors - получить должников
  static async getDebtors(req, res) {
    try {
      const debtors = await Student.findDebtors();
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          debtors,
          count: debtors.length
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
  
  // GET /api/students/active - получить активных студентов
  static async getActiveStudents(req, res) {
    try {
      const activeStudents = await Student.findActive();
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          students: activeStudents,
          count: activeStudents.length
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
  
  // GET /api/students/:id - получить студента по ID
  static async getStudentById(req, res) {
    try {
      const { id } = req.params;
      
      const student = await Student.findByPk(id);
      if (!student) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.STUDENT_NOT_FOUND
        });
      }
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          student
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
  
  // POST /api/students - создать нового студента
  static async createStudent(req, res) {
    try {
      const {
        first_name,
        last_name,
        middle_name,
        phone,
        photo,
        balance = 0,
        birth_date,
        notes
      } = req.body;
      
      // Валидация обязательных полей
      if (!first_name || !last_name || !phone) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Имя, фамилия и телефон обязательны'
        });
      }
      
      // Проверяем не существует ли студент с таким телефоном
      const existingStudent = await Student.findByPhone(phone);
      if (existingStudent) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: 'Студент с таким номером телефона уже существует'
        });
      }
      
      // Создаем студента
      const studentData = {
        first_name,
        last_name,
        middle_name: middle_name || null,
        phone,
        photo: photo || null,
        balance: parseFloat(balance) || 0,
        birth_date: birth_date || null,
        notes: notes || null,
        status: STUDENT_STATUS.ACTIVE,
        registration_date: new Date()
      };
      
      const student = await Student.create(studentData);
      
      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: SUCCESS_MESSAGES.CREATED,
        data: {
          student
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
  
  // PUT /api/students/:id - обновить студента
  static async updateStudent(req, res) {
    try {
      const { id } = req.params;
      const {
        first_name,
        last_name,
        middle_name,
        phone,
        photo,
        birth_date,
        notes
      } = req.body;
      
      const student = await Student.findByPk(id);
      if (!student) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.STUDENT_NOT_FOUND
        });
      }
      
      // Если меняется телефон, проверяем уникальность
      if (phone && phone !== student.phone) {
        const existingStudent = await Student.findByPhone(phone);
        if (existingStudent) {
          return res.status(HTTP_STATUS.CONFLICT).json({
            success: false,
            message: 'Студент с таким номером телефона уже существует'
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
      if (birth_date !== undefined) updateData.birth_date = birth_date;
      if (notes !== undefined) updateData.notes = notes;
      
      await student.update(updateData);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: SUCCESS_MESSAGES.UPDATED,
        data: {
          student
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
  
  // PATCH /api/students/:id/status - изменить статус студента
  static async updateStudentStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || !Object.values(STUDENT_STATUS).includes(status)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Недопустимый статус студента'
        });
      }
      
      const student = await Student.findByPk(id);
      if (!student) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.STUDENT_NOT_FOUND
        });
      }
      
      await student.update({ status });
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: `Статус студента изменен на: ${status}`,
        data: {
          student
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
  
  // PATCH /api/students/:id/balance - пополнить/списать баланс
  static async updateBalance(req, res) {
    try {
      const { id } = req.params;
      const { amount, operation = 'add' } = req.body; // 'add' или 'subtract'
      
      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Сумма должна быть положительным числом'
        });
      }
      
      const student = await Student.findByPk(id);
      if (!student) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.STUDENT_NOT_FOUND
        });
      }
      
      const currentBalance = parseFloat(student.balance);
      let newBalance;
      
      if (operation === 'add') {
        newBalance = currentBalance + parseFloat(amount);
      } else if (operation === 'subtract') {
        newBalance = currentBalance - parseFloat(amount);
        if (newBalance < 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'Недостаточно средств на балансе'
          });
        }
      } else {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Операция должна быть add или subtract'
        });
      }
      
      await student.update({ balance: newBalance });
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: `Баланс ${operation === 'add' ? 'пополнен' : 'списан'} на ${amount}`,
        data: {
          student,
          operation: {
            type: operation,
            amount: parseFloat(amount),
            previousBalance: currentBalance,
            newBalance: newBalance
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
  
  // DELETE /api/students/:id - удалить студента
  static async deleteStudent(req, res) {
    try {
      const { id } = req.params;
      
      const student = await Student.findByPk(id);
      if (!student) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.STUDENT_NOT_FOUND
        });
      }
      
      // TODO: Проверить есть ли связанные записи (группы, посещаемость, платежи)
      
      await student.destroy();
      
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

module.exports = StudentController;