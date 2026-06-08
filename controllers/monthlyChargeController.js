const { MonthlyCharge, Student, Group, Course, Payment } = require('../models');
const { PAYMENT_TYPES } = require('../utils/constants');

const monthlyChargeController = {
  // GET /api/monthly-charges - получить все ежемесячные списания
  getAllCharges: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        student_id,
        group_id,
        status,
        start_date,
        end_date,
        overdue_only
      } = req.query;

      const offset = (page - 1) * limit;
      let whereClause = {};

      // Фильтрация
      if (student_id) whereClause.student_id = student_id;
      if (group_id) whereClause.group_id = group_id;
      if (status) whereClause.status = status;

      // Фильтрация по датам
      if (start_date || end_date) {
        const { Op } = require('sequelize');
        whereClause.charge_date = {};
        
        if (start_date) {
          whereClause.charge_date[Op.gte] = start_date;
        }
        if (end_date) {
          whereClause.charge_date[Op.lte] = end_date;
        }
      }

      // Только просроченные
      if (overdue_only === 'true') {
        const { Op } = require('sequelize');
        whereClause.status = 'pending';
        whereClause.due_date = {
          [Op.lt]: new Date()
        };
      }

      const { count, rows: charges } = await MonthlyCharge.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Student,
            as: 'student',
            attributes: ['id', 'first_name', 'last_name', 'phone', 'balance', 'status']
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
          },
          {
            model: Payment,
            as: 'payment',
            attributes: ['id', 'amount', 'payment_date'],
            required: false
          }
        ],
        order: [
          ['due_date', 'ASC'],
          ['charge_date', 'DESC']
        ],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: {
          charges,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(count / limit)
          }
        }
      });
    } catch (error) {
      console.error('Ошибка получения ежемесячных списаний:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при получении списаний'
      });
    }
  },

  // GET /api/monthly-charges/pending - получить списания к обработке
  getPendingCharges: async (req, res) => {
    try {
      const charges = await MonthlyCharge.findReadyToProcess();

      // Включаем связанные данные
      const chargesWithData = await MonthlyCharge.findAll({
        where: {
          id: charges.map(c => c.id)
        },
        include: [
          {
            model: Student,
            as: 'student',
            attributes: ['id', 'first_name', 'last_name', 'phone', 'balance', 'status']
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
        ],
        order: [
          ['charge_date', 'ASC'],
          ['next_retry_date', 'ASC']
        ]
      });

      res.json({
        success: true,
        data: {
          charges: chargesWithData,
          count: chargesWithData.length
        }
      });
    } catch (error) {
      console.error('Ошибка получения списаний к обработке:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при получении списаний к обработке'
      });
    }
  },

  // GET /api/monthly-charges/overdue - получить просроченные списания
  getOverdueCharges: async (req, res) => {
    try {
      const charges = await MonthlyCharge.findOverdue();

      // Включаем связанные данные
      const chargesWithData = await MonthlyCharge.findAll({
        where: {
          id: charges.map(c => c.id)
        },
        include: [
          {
            model: Student,
            as: 'student',
            attributes: ['id', 'first_name', 'last_name', 'phone', 'balance', 'status']
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
        ],
        order: [['due_date', 'ASC']]
      });

      res.json({
        success: true,
        data: {
          charges: chargesWithData,
          count: chargesWithData.length
        }
      });
    } catch (error) {
      console.error('Ошибка получения просроченных списаний:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при получении просроченных списаний'
      });
    }
  },

  // GET /api/monthly-charges/student/:studentId - получить списания студента
  getStudentCharges: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { start_date, end_date } = req.query;

      const charges = await MonthlyCharge.findByStudent(studentId, start_date, end_date);

      // Включаем связанные данные
      const chargesWithData = await MonthlyCharge.findAll({
        where: {
          id: charges.map(c => c.id)
        },
        include: [
          {
            model: Group,
            as: 'group',
            attributes: ['id', 'name'],
            include: [{
              model: Course,
              as: 'course',
              attributes: ['id', 'name', 'price_per_month']
            }]
          },
          {
            model: Payment,
            as: 'payment',
            attributes: ['id', 'amount', 'payment_date'],
            required: false
          }
        ],
        order: [['charge_date', 'DESC']]
      });

      res.json({
        success: true,
        data: {
          charges: chargesWithData,
          count: chargesWithData.length
        }
      });
    } catch (error) {
      console.error('Ошибка получения списаний студента:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при получении списаний студента'
      });
    }
  },

  // GET /api/monthly-charges/stats - получить статистику списаний
  getChargesStats: async (req, res) => {
    try {
      const { start_date, end_date } = req.query;

      const stats = await MonthlyCharge.getStats(start_date, end_date);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Ошибка получения статистики списаний:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при получении статистики'
      });
    }
  },

  // GET /api/monthly-charges/:id - получить списание по ID
  getChargeById: async (req, res) => {
    try {
      const { id } = req.params;

      const charge = await MonthlyCharge.findByPk(id, {
        include: [
          {
            model: Student,
            as: 'student',
            attributes: ['id', 'first_name', 'last_name', 'phone', 'balance', 'status']
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
          },
          {
            model: Payment,
            as: 'payment',
            attributes: ['id', 'amount', 'payment_date', 'description'],
            required: false
          }
        ]
      });

      if (!charge) {
        return res.status(404).json({
          success: false,
          message: 'Списание не найдено'
        });
      }

      res.json({
        success: true,
        data: charge
      });
    } catch (error) {
      console.error('Ошибка получения списания:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при получении списания'
      });
    }
  },

  // POST /api/monthly-charges - создать списание для студента
  createCharge: async (req, res) => {
    try {
      const {
        student_id,
        group_id,
        charge_date,
        amount,
        due_date
      } = req.body;

      const charge = await MonthlyCharge.createForStudent(
        student_id,
        group_id,
        charge_date,
        amount,
        due_date
      );

      // Получаем созданное списание с связанными данными
      const createdCharge = await MonthlyCharge.findByPk(charge.id, {
        include: [
          {
            model: Student,
            as: 'student',
            attributes: ['id', 'first_name', 'last_name', 'balance']
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
        message: 'Списание успешно создано',
        data: createdCharge
      });
    } catch (error) {
      console.error('Ошибка создания списания:', error);
      
      if (error.message.includes('уже существует')) {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }

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
        message: 'Ошибка сервера при создании списания'
      });
    }
  },

  // POST /api/monthly-charges/create-monthly - создать ежемесячные списания для всех
  createMonthlyCharges: async (req, res) => {
    try {
      const { charge_date } = req.body;

      if (!charge_date) {
        return res.status(400).json({
          success: false,
          message: 'Дата списания обязательна'
        });
      }

      const result = await MonthlyCharge.createMonthlyChargesForAll(charge_date);

      res.status(201).json({
        success: true,
        message: `Создано ${result.created_charges} ежемесячных списаний`,
        data: {
          created_count: result.created_charges,
          errors_count: result.errors.length,
          errors: result.errors
        }
      });
    } catch (error) {
      console.error('Ошибка создания ежемесячных списаний:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при создании ежемесячных списаний'
      });
    }
  },

  // POST /api/monthly-charges/:id/process - обработать конкретное списание
  processCharge: async (req, res) => {
    try {
      const { id } = req.params;
      const { sequelize } = require('../models');

      // Начинаем транзакцию
      const transaction = await sequelize.transaction();

      try {
        const charge = await MonthlyCharge.findByPk(id, { transaction });

        if (!charge) {
          await transaction.rollback();
          return res.status(404).json({
            success: false,
            message: 'Списание не найдено'
          });
        }

        if (charge.status !== 'pending' && charge.status !== 'failed') {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: 'Списание уже обработано или отменено'
          });
        }

        // Получаем студента
        const student = await Student.findByPk(charge.student_id, { transaction });
        if (!student) {
          await transaction.rollback();
          return res.status(404).json({
            success: false,
            message: 'Студент не найден'
          });
        }

        // Проверяем баланс
        if (parseFloat(student.balance) < parseFloat(charge.amount)) {
          // Недостаточно средств - отмечаем как неудачное
          await charge.update({
            status: 'failed',
            failure_reason: 'Недостаточно средств на балансе',
            retry_count: charge.retry_count + 1,
            next_retry_date: charge.retry_count < 2 ? 
              new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) : // 3 дня
              null,
            processed_at: new Date()
          }, { transaction });

          // Обновляем статус студента на должник
          if (student.status === 'active') {
            await student.update({ status: 'debtor' }, { transaction });
          }

          await transaction.commit();

          return res.json({
            success: false,
            message: 'Недостаточно средств для списания',
            data: {
              charge_id: charge.id,
              student_balance: student.balance,
              charge_amount: charge.amount,
              retry_available: charge.retry_count < 2
            }
          });
        }

        // Создаем платеж
        const payment = await Payment.createPayment({
          student_id: charge.student_id,
          amount: charge.amount,
          payment_type: PAYMENT_TYPES.MONTHLY_CHARGE,
          description: `Автоматическое списание за группу`,
          group_id: charge.group_id,
          processed_by: req.user.id,
          is_automatic: true
        }, transaction);

        // Обновляем списание
        await charge.update({
          status: 'charged',
          payment_id: payment.id,
          processed_at: new Date()
        }, { transaction });

        await transaction.commit();

        // Получаем обновленное списание с данными
        const updatedCharge = await MonthlyCharge.findByPk(id, {
          include: [
            {
              model: Student,
              as: 'student',
              attributes: ['id', 'first_name', 'last_name', 'balance']
            },
            {
              model: Payment,
              as: 'payment',
              attributes: ['id', 'amount', 'payment_date']
            }
          ]
        });

        res.json({
          success: true,
          message: 'Списание успешно обработано',
          data: updatedCharge
        });

      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Ошибка обработки списания:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при обработке списания'
      });
    }
  },

  // POST /api/monthly-charges/process-pending - обработать все готовые списания
  processPendingCharges: async (req, res) => {
    try {
      const pendingCharges = await MonthlyCharge.findReadyToProcess();
      
      let processed = 0;
      let failed = 0;
      const results = [];

      for (const charge of pendingCharges) {
        try {
          // Обрабатываем каждое списание
          const result = await processChargeInternal(charge.id, req.user.id);
          results.push(result);
          
          if (result.success) {
            processed++;
          } else {
            failed++;
          }
        } catch (error) {
          failed++;
          results.push({
            charge_id: charge.id,
            success: false,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        message: `Обработано списаний: ${processed} успешно, ${failed} с ошибками`,
        data: {
          total_processed: pendingCharges.length,
          successful: processed,
          failed: failed,
          results: results
        }
      });
    } catch (error) {
      console.error('Ошибка массовой обработки списаний:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при массовой обработке списаний'
      });
    }
  },

  // PATCH /api/monthly-charges/:id/cancel - отменить списание
  cancelCharge: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const charge = await MonthlyCharge.findByPk(id);

      if (!charge) {
        return res.status(404).json({
          success: false,
          message: 'Списание не найдено'
        });
      }

      if (charge.status === 'charged') {
        return res.status(400).json({
          success: false,
          message: 'Нельзя отменить уже обработанное списание'
        });
      }

      await charge.update({
        status: 'cancelled',
        failure_reason: reason || 'Отменено администратором',
        processed_at: new Date()
      });

      res.json({
        success: true,
        message: 'Списание успешно отменено',
        data: charge
      });
    } catch (error) {
      console.error('Ошибка отмены списания:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при отмене списания'
      });
    }
  },

  // DELETE /api/monthly-charges/:id - удалить списание (только если не обработано)
  deleteCharge: async (req, res) => {
    try {
      const { id } = req.params;

      const charge = await MonthlyCharge.findByPk(id);

      if (!charge) {
        return res.status(404).json({
          success: false,
          message: 'Списание не найдено'
        });
      }

      if (charge.status === 'charged') {
        return res.status(400).json({
          success: false,
          message: 'Нельзя удалить уже обработанное списание'
        });
      }

      await charge.destroy();

      res.json({
        success: true,
        message: 'Список успешно удалено'
      });
    } catch (error) {
      console.error('Ошибка удаления списания:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при удалении списания'
      });
    }
  }
};

// Вспомогательная функция для обработки списания (внутренняя)
async function processChargeInternal(chargeId, userId) {
  const { sequelize } = require('../models');
  const transaction = await sequelize.transaction();

  try {
    const charge = await MonthlyCharge.findByPk(chargeId, { transaction });
    const student = await Student.findByPk(charge.student_id, { transaction });

    if (parseFloat(student.balance) < parseFloat(charge.amount)) {
      await charge.update({
        status: 'failed',
        failure_reason: 'Недостаточно средств на балансе',
        retry_count: charge.retry_count + 1,
        next_retry_date: charge.retry_count < 2 ? 
          new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) : null,
        processed_at: new Date()
      }, { transaction });

      if (student.status === 'active') {
        await student.update({ status: 'debtor' }, { transaction });
      }

      await transaction.commit();
      return { charge_id: chargeId, success: false, reason: 'Недостаточно средств' };
    }

    const payment = await Payment.createPayment({
      student_id: charge.student_id,
      amount: charge.amount,
      payment_type: PAYMENT_TYPES.MONTHLY_CHARGE,
      description: `Автоматическое списание за группу`,
      group_id: charge.group_id,
      processed_by: userId,
      is_automatic: true
    }, transaction);

    await charge.update({
      status: 'charged',
      payment_id: payment.id,
      processed_at: new Date()
    }, { transaction });

    await transaction.commit();
    return { charge_id: chargeId, success: true, payment_id: payment.id };

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

module.exports = monthlyChargeController;