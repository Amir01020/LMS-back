const { Payment, Student, Group, Course, User } = require('../models');
const { HTTP_STATUS, SUCCESS_MESSAGES, ERROR_MESSAGES, PAYMENT_TYPES } = require('../utils/constants');

class PaymentController {
  
  // GET /api/payments - получить все платежи
  static async getAllPayments(req, res) {
    try {
      const { 
        student_id, 
        payment_type, 
        group_id,
        start_date,
        end_date,
        is_automatic,
        page = 1, 
        limit = 100 
      } = req.query;
      
      let whereClause = {};
      const offset = (page - 1) * limit;
      
      // Фильтры
      if (student_id) whereClause.student_id = student_id;
      if (payment_type) whereClause.payment_type = payment_type;
      if (group_id) whereClause.group_id = group_id;
      if (is_automatic !== undefined) whereClause.is_automatic = is_automatic === 'true';
      
      // Диапазон дат
      if (start_date || end_date) {
        const { Op } = require('sequelize');
        whereClause.payment_date = {};
        if (start_date) whereClause.payment_date[Op.gte] = start_date;
        if (end_date) whereClause.payment_date[Op.lte] = end_date;
      }
      
      const result = await Payment.findAndCountAll({
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
            attributes: ['id', 'name'],
            include: [{
              model: Course,
              as: 'course',
              attributes: ['id', 'name']
            }]
          },
          {
            model: User,
            as: 'processedByUser',
            attributes: ['id', 'login', 'role']
          }
        ],
        order: [['payment_date', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          payments: result.rows,
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
  
  // GET /api/payments/student/:studentId - получить платежи студента
  static async getStudentPayments(req, res) {
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
      
      const payments = await Payment.findByStudent(studentId, start_date, end_date);
      const stats = await Payment.getStudentStats(studentId, start_date, end_date);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          student: {
            id: student.id,
            name: student.getFullName(),
            current_balance: student.balance,
            status: student.status
          },
          payments,
          stats,
          count: payments.length
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
  
  // GET /api/payments/revenue - получить статистику доходов
  static async getRevenueStats(req, res) {
    try {
      const { start_date, end_date } = req.query;
      
      const revenueStats = await Payment.getRevenueStats(start_date, end_date);
      const revenueByCourse = await Payment.getRevenueByCourse(start_date, end_date);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          period: {
            start_date: start_date || null,
            end_date: end_date || null
          },
          overall_stats: revenueStats,
          revenue_by_course: revenueByCourse
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
  
  // GET /api/payments/debtors - получить студентов с отрицательным балансом
  static async getDebtors(req, res) {
    try {
      const negativeBalances = await Payment.findNegativeBalances();
      
      // Добавляем информацию о студентах
      const debtorsWithInfo = await Promise.all(
        negativeBalances.map(async (record) => {
          const student = await Student.findByPk(record.student_id, {
            attributes: ['id', 'first_name', 'last_name', 'phone', 'status']
          });
          return {
            student,
            current_balance: parseFloat(record.current_balance),
            last_payment_date: record.last_payment_date
          };
        })
      );
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          debtors: debtorsWithInfo,
          count: debtorsWithInfo.length
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
  
  // POST /api/payments/deposit - пополнить баланс студента
  static async createDeposit(req, res) {
    try {
      const { student_id, amount, description } = req.body;
      
      // Валидация
      if (!student_id || !amount || amount <= 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'ID студента и положительная сумма обязательны'
        });
      }
      
      const student = await Student.findByPk(student_id);
      if (!student) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.STUDENT_NOT_FOUND
        });
      }
      
      // Создаем платеж
      const payment = await Payment.createPayment({
        student_id,
        amount: parseFloat(amount),
        payment_type: PAYMENT_TYPES.DEPOSIT,
        description: description || `Пополнение баланса на ${amount}`,
        processed_by: req.user.userId,
        is_automatic: false
      });
      
      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: SUCCESS_MESSAGES.PAYMENT_PROCESSED,
        data: {
          payment,
          new_balance: payment.balance_after
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
  
  // POST /api/payments/charge - списать средства со студента
  static async createCharge(req, res) {
    try {
      const { student_id, amount, group_id, description } = req.body;
      
      // Валидация
      if (!student_id || !amount || amount <= 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'ID студента и положительная сумма обязательны'
        });
      }
      
      const student = await Student.findByPk(student_id);
      if (!student) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.STUDENT_NOT_FOUND
        });
      }
      
      // Проверяем достаточность средств
      if (parseFloat(student.balance) < parseFloat(amount)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: ERROR_MESSAGES.INSUFFICIENT_BALANCE
        });
      }
      
      // Проверяем группу если указана
      if (group_id) {
        const group = await Group.findByPk(group_id);
        if (!group) {
          return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: ERROR_MESSAGES.GROUP_NOT_FOUND
          });
        }
      }
      
      // Создаем платеж
      const payment = await Payment.createPayment({
        student_id,
        amount: parseFloat(amount),
        payment_type: PAYMENT_TYPES.MONTHLY_CHARGE,
        description: description || `Списание за обучение: ${amount}`,
        group_id: group_id || null,
        processed_by: req.user.userId,
        is_automatic: false
      });
      
      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: SUCCESS_MESSAGES.PAYMENT_PROCESSED,
        data: {
          payment,
          new_balance: payment.balance_after
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
  
  // POST /api/payments/refund - вернуть средства студенту
  static async createRefund(req, res) {
    try {
      const { student_id, amount, description } = req.body;
      
      // Валидация
      if (!student_id || !amount || amount <= 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'ID студента и положительная сумма обязательны'
        });
      }
      
      const student = await Student.findByPk(student_id);
      if (!student) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.STUDENT_NOT_FOUND
        });
      }
      
      // Создаем платеж
      const payment = await Payment.createPayment({
        student_id,
        amount: parseFloat(amount),
        payment_type: PAYMENT_TYPES.REFUND,
        description: description || `Возврат средств: ${amount}`,
        processed_by: req.user.userId,
        is_automatic: false
      });
      
      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: SUCCESS_MESSAGES.PAYMENT_PROCESSED,
        data: {
          payment,
          new_balance: payment.balance_after
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
  
  // GET /api/payments/:id - получить платеж по ID
  static async getPaymentById(req, res) {
    try {
      const { id } = req.params;
      
      const payment = await Payment.findByPk(id, {
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
            model: User,
            as: 'processedByUser',
            attributes: ['id', 'login']
          }
        ]
      });
      
      if (!payment) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Платеж не найден'
        });
      }
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          payment
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
  
  // DELETE /api/payments/:id - удалить платеж (только для корректировок)
  static async deletePayment(req, res) {
    try {
      const { id } = req.params;
      
      const payment = await Payment.findByPk(id);
      if (!payment) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Платеж не найден'
        });
      }
      
      // Проверяем что это не автоматический платеж
      if (payment.is_automatic) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Автоматические платежи нельзя удалять'
        });
      }
      
      // Восстанавливаем баланс студента
      const student = await Student.findByPk(payment.student_id);
      if (student) {
        await student.update({ balance: payment.balance_before });
      }
      
      await payment.destroy();
      
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

module.exports = PaymentController;