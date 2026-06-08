const cron = require('node-cron');
const { MonthlyCharge, Student, Group, Course, Payment } = require('../models');
const { PAYMENT_TYPES } = require('../utils/constants');

class CronService {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  // Запуск всех cron-задач
  start() {
    if (this.isRunning) {
      console.log('⚠️ Cron-задачи уже запущены');
      return;
    }

    console.log('🚀 Запуск cron-задач...');
    
    // Ежедневная проверка и обработка списаний в 09:00
    this.scheduleTask('daily-charges', '0 9 * * *', this.processDailyCharges.bind(this));
    
    // Создание ежемесячных списаний 1 числа каждого месяца в 08:00
    this.scheduleTask('monthly-charges', '0 8 1 * *', this.createMonthlyCharges.bind(this));
    
    // Проверка просроченных платежей каждый день в 10:00
    this.scheduleTask('overdue-check', '0 10 * * *', this.checkOverduePayments.bind(this));
    
    // Обновление статусов студентов каждый час
    this.scheduleTask('update-statuses', '0 * * * *', this.updateStudentStatuses.bind(this));

    this.isRunning = true;
    console.log('✅ Все cron-задачи запущены успешно');
  }

  // Остановка всех cron-задач
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Cron-задачи уже остановлены');
      return;
    }

    console.log('🛑 Остановка cron-задач...');
    
    for (const [name, task] of this.jobs) {
      task.stop();
      console.log(`📴 Остановлена задача: ${name}`);
    }
    
    this.jobs.clear();
    this.isRunning = false;
    console.log('✅ Все cron-задачи остановлены');
  }

  // Планирование задачи
  scheduleTask(name, schedule, callback) {
    try {
      const task = cron.schedule(schedule, async () => {
        console.log(`⏰ Выполнение задачи: ${name} - ${new Date().toISOString()}`);
        try {
          await callback();
          console.log(`✅ Задача выполнена: ${name}`);
        } catch (error) {
          console.error(`❌ Ошибка выполнения задачи ${name}:`, error);
        }
      }, {
        scheduled: false,
        timezone: 'Asia/Tashkent'
      });

      task.start();
      this.jobs.set(name, task);
      console.log(`📅 Запланирована задача: ${name} (${schedule})`);
    } catch (error) {
      console.error(`❌ Ошибка создания задачи ${name}:`, error);
    }
  }

  // Ежедневная обработка готовых списаний
  async processDailyCharges() {
    try {
      console.log('🔄 Начинаем обработку ежедневных списаний...');
      
      const pendingCharges = await MonthlyCharge.findReadyToProcess();
      
      if (pendingCharges.length === 0) {
        console.log('📋 Нет списаний для обработки');
        return;
      }

      let processed = 0;
      let failed = 0;

      for (const charge of pendingCharges) {
        try {
          const result = await this.processChargeInternal(charge.id);
          if (result.success) {
            processed++;
          } else {
            failed++;
          }
        } catch (error) {
          console.error(`❌ Ошибка обработки списания ${charge.id}:`, error);
          failed++;
        }
      }

      console.log(`📊 Обработка завершена: ${processed} успешно, ${failed} неудачно`);
      
      // Можно добавить отправку уведомления админу
      if (failed > 0) {
        console.log(`⚠️ ВНИМАНИЕ: ${failed} списаний не удалось обработать`);
      }

    } catch (error) {
      console.error('❌ Критическая ошибка при обработке ежедневных списаний:', error);
    }
  }

  // Создание ежемесячных списаний (1 числа месяца)
  async createMonthlyCharges() {
    try {
      console.log('📅 Создание ежемесячных списаний...');
      
      const today = new Date();
      const chargeDate = new Date(today.getFullYear(), today.getMonth(), 1);
      
      const result = await MonthlyCharge.createMonthlyChargesForAll(chargeDate);
      
      console.log(`📋 Создано ${result.created_charges} ежемесячных списаний`);
      
      if (result.errors.length > 0) {
        console.log(`⚠️ ${result.errors.length} ошибок при создании списаний:`, result.errors);
      }

    } catch (error) {
      console.error('❌ Ошибка создания ежемесячных списаний:', error);
    }
  }

  // Проверка просроченных платежей
  async checkOverduePayments() {
    try {
      console.log('🔍 Проверка просроченных платежей...');
      
      const overdueCharges = await MonthlyCharge.findOverdue();
      
      if (overdueCharges.length === 0) {
        console.log('✅ Просроченных платежей не найдено');
        return;
      }

      console.log(`⚠️ Найдено ${overdueCharges.length} просроченных платежей`);
      
      // Обновляем статусы студентов на "должник"
      const studentIds = [...new Set(overdueCharges.map(charge => charge.student_id))];
      
      await Student.update(
        { status: 'debtor' },
        { 
          where: { 
            id: studentIds,
            status: 'active' // Обновляем только активных студентов
          }
        }
      );

      console.log(`📝 Обновлены статусы для ${studentIds.length} студентов на "должник"`);

    } catch (error) {
      console.error('❌ Ошибка проверки просроченных платежей:', error);
    }
  }

  // Обновление статусов студентов
  async updateStudentStatuses() {
    try {
      console.log('🔄 Обновление статусов студентов...');
      
      // Находим должников с положительным балансом
      const { Op } = require('sequelize');
      const debtorsWithBalance = await Student.findAll({
        where: {
          status: 'debtor',
          balance: {
            [Op.gt]: 0
          }
        }
      });

      if (debtorsWithBalance.length > 0) {
        // Проверяем, есть ли у них просроченные списания
        for (const student of debtorsWithBalance) {
          const overdueCharges = await MonthlyCharge.findAll({
            where: {
              student_id: student.id,
              status: 'pending',
              due_date: {
                [Op.lt]: new Date()
              }
            }
          });

          // Если нет просроченных списаний, возвращаем статус "активен"
          if (overdueCharges.length === 0) {
            await student.update({ status: 'active' });
            console.log(`✅ Студент ${student.first_name} ${student.last_name} переведен в статус "активен"`);
          }
        }
      }

      console.log('✅ Обновление статусов завершено');

    } catch (error) {
      console.error('❌ Ошибка обновления статусов студентов:', error);
    }
  }

  // Внутренняя функция для обработки списания
  async processChargeInternal(chargeId) {
    const { sequelize } = require('../models');
    const transaction = await sequelize.transaction();

    try {
      const charge = await MonthlyCharge.findByPk(chargeId, { transaction });
      if (!charge) {
        await transaction.rollback();
        return { charge_id: chargeId, success: false, reason: 'Списание не найдено' };
      }

      const student = await Student.findByPk(charge.student_id, { transaction });
      if (!student) {
        await transaction.rollback();
        return { charge_id: chargeId, success: false, reason: 'Студент не найден' };
      }

      // Проверяем баланс
      if (parseFloat(student.balance) < parseFloat(charge.amount)) {
        // Недостаточно средств
        await charge.update({
          status: 'failed',
          failure_reason: 'Недостаточно средств на балансе',
          retry_count: charge.retry_count + 1,
          next_retry_date: charge.retry_count < 2 ? 
            new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) : null,
          processed_at: new Date()
        }, { transaction });

        // Обновляем статус студента на должник
        if (student.status === 'active') {
          await student.update({ status: 'debtor' }, { transaction });
        }

        await transaction.commit();
        return { charge_id: chargeId, success: false, reason: 'Недостаточно средств' };
      }

      // Создаем платеж
      const payment = await Payment.createPayment({
        student_id: charge.student_id,
        amount: charge.amount,
        payment_type: PAYMENT_TYPES.MONTHLY_CHARGE,
        description: `Автоматическое списание за группу`,
        group_id: charge.group_id,
        processed_by: null, // Автоматическое списание
        is_automatic: true
      }, transaction);

      // Обновляем списание
      await charge.update({
        status: 'charged',
        payment_id: payment.id,
        processed_at: new Date()
      }, { transaction });

      await transaction.commit();
      return { charge_id: chargeId, success: true, payment_id: payment.id };

    } catch (error) {
      await transaction.rollback();
      console.error(`❌ Ошибка обработки списания ${chargeId}:`, error);
      return { charge_id: chargeId, success: false, reason: error.message };
    }
  }

  // Получить статус всех задач
  getStatus() {
    const tasks = [];
    for (const [name, task] of this.jobs) {
      tasks.push({
        name,
        running: task.running,
        scheduled: task.scheduled
      });
    }

    return {
      service_running: this.isRunning,
      total_tasks: this.jobs.size,
      tasks
    };
  }

  // Запустить конкретную задачу вручную
  async runTask(taskName) {
    const taskMethods = {
      'daily-charges': this.processDailyCharges.bind(this),
      'monthly-charges': this.createMonthlyCharges.bind(this),
      'overdue-check': this.checkOverduePayments.bind(this),
      'update-statuses': this.updateStudentStatuses.bind(this)
    };

    const method = taskMethods[taskName];
    if (!method) {
      throw new Error(`Задача "${taskName}" не найдена`);
    }

    console.log(`🔧 Ручной запуск задачи: ${taskName}`);
    await method();
    console.log(`✅ Задача "${taskName}" выполнена вручную`);
  }
}

// Создаем единственный экземпляр сервиса
const cronService = new CronService();

module.exports = cronService;