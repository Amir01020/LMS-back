const { Student, Teacher, Group, Course, Payment, MonthlyCharge, StudentComment, User } = require('../models');
const { PAYMENT_TYPES } = require('../utils/constants');

const reportController = {
  // GET /api/reports/revenue - общий доход за период
  getRevenueReport: async (req, res) => {
    try {
      const { start_date, end_date, group_by = 'month' } = req.query;
      const { Op, fn, col, literal } = require('sequelize');

      let whereClause = {
        payment_type: PAYMENT_TYPES.MONTHLY_CHARGE
      };

      if (start_date && end_date) {
        whereClause.payment_date = {
          [Op.between]: [start_date, end_date]
        };
      } else if (start_date) {
        whereClause.payment_date = {
          [Op.gte]: start_date
        };
      } else if (end_date) {
        whereClause.payment_date = {
          [Op.lte]: end_date
        };
      }

      // Группировка по периодам
      let dateFormat;
      switch (group_by) {
        case 'day':
          dateFormat = '%Y-%m-%d';
          break;
        case 'week':
          dateFormat = '%Y-%u';
          break;
        case 'month':
          dateFormat = '%Y-%m';
          break;
        case 'year':
          dateFormat = '%Y';
          break;
        default:
          dateFormat = '%Y-%m';
      }

      const revenueData = await Payment.findAll({
        where: whereClause,
        attributes: [
          [fn('DATE_FORMAT', col('payment_date'), dateFormat), 'period'],
          [fn('COUNT', col('*')), 'payment_count'],
          [fn('SUM', literal('ABS(amount)')), 'total_revenue'],
          [fn('COUNT', fn('DISTINCT', col('student_id'))), 'unique_students'],
          [fn('COUNT', fn('DISTINCT', col('group_id'))), 'unique_groups']
        ],
        group: [literal('period')],
        order: [literal('period ASC')],
        raw: true
      });

      // Общая статистика
      const totalStats = await Payment.findAll({
        where: whereClause,
        attributes: [
          [fn('COUNT', col('*')), 'total_payments'],
          [fn('SUM', literal('ABS(amount)')), 'total_revenue'],
          [fn('COUNT', fn('DISTINCT', col('student_id'))), 'total_unique_students'],
          [fn('COUNT', fn('DISTINCT', col('group_id'))), 'total_unique_groups'],
          [fn('AVG', literal('ABS(amount)')), 'average_payment']
        ],
        raw: true
      });

      res.json({
        success: true,
        data: {
          period_data: revenueData.map(item => ({
            period: item.period,
            payment_count: parseInt(item.payment_count) || 0,
            total_revenue: parseFloat(item.total_revenue) || 0,
            unique_students: parseInt(item.unique_students) || 0,
            unique_groups: parseInt(item.unique_groups) || 0
          })),
          summary: {
            total_payments: parseInt(totalStats[0].total_payments) || 0,
            total_revenue: parseFloat(totalStats[0].total_revenue) || 0,
            total_unique_students: parseInt(totalStats[0].total_unique_students) || 0,
            total_unique_groups: parseInt(totalStats[0].total_unique_groups) || 0,
            average_payment: parseFloat(totalStats[0].average_payment) || 0
          }
        }
      });
    } catch (error) {
      console.error('Ошибка получения отчета по доходам:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при получении отчета по доходам'
      });
    }
  },

  // GET /api/reports/course-revenue - доход по курсам
  getCourseRevenueReport: async (req, res) => {
    try {
      const { start_date, end_date } = req.query;
      const { Op, fn, col, literal } = require('sequelize');

      let whereClause = {
        payment_type: PAYMENT_TYPES.MONTHLY_CHARGE
      };

      if (start_date && end_date) {
        whereClause.payment_date = {
          [Op.between]: [start_date, end_date]
        };
      }

      const courseRevenue = await Payment.findAll({
        where: whereClause,
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
          }
        ],
        attributes: [
          [fn('COUNT', col('Payment.id')), 'payment_count'],
          [fn('SUM', literal('ABS(Payment.amount)')), 'total_revenue'],
          [fn('COUNT', fn('DISTINCT', col('Payment.student_id'))), 'unique_students'],
          [fn('COUNT', fn('DISTINCT', col('Payment.group_id'))), 'unique_groups']
        ],
        group: ['group.course.id'],
        order: [[literal('total_revenue'), 'DESC']],
        raw: false
      });

      res.json({
        success: true,
        data: courseRevenue.map(item => ({
          course: item.group?.course || null,
          payment_count: parseInt(item.getDataValue('payment_count')) || 0,
          total_revenue: parseFloat(item.getDataValue('total_revenue')) || 0,
          unique_students: parseInt(item.getDataValue('unique_students')) || 0,
          unique_groups: parseInt(item.getDataValue('unique_groups')) || 0
        }))
      });
    } catch (error) {
      console.error('Ошибка получения отчета по курсам:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при получении отчета по курсам'
      });
    }
  },

  // GET /api/reports/teacher-salary - отчет для расчета зарплаты учителей
  getTeacherSalaryReport: async (req, res) => {
    try {
      const { start_date, end_date, teacher_id } = req.query;
      const { Op, fn, col, literal } = require('sequelize');

      let paymentWhereClause = {
        payment_type: PAYMENT_TYPES.MONTHLY_CHARGE
      };

      if (start_date && end_date) {
        paymentWhereClause.payment_date = {
          [Op.between]: [start_date, end_date]
        };
      }

      // Базовый запрос для учителей
      let teacherWhereClause = { is_active: true };
      if (teacher_id) {
        teacherWhereClause.id = teacher_id;
      }

      const teacherSalaryData = await Teacher.findAll({
        where: teacherWhereClause,
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['login']
          },
          {
            model: Group,
            as: 'groups',
            where: { is_active: true },
            required: false,
            include: [
              {
                model: Course,
                as: 'course',
                attributes: ['id', 'name', 'price_per_month']
              }
            ]
          }
        ],
        attributes: [
          'id', 'first_name', 'last_name', 'middle_name',
          'salary_per_student', 'hire_date'
        ]
      });

      // Обрабатываем данные для каждого учителя
      const salaryReport = await Promise.all(teacherSalaryData.map(async (teacher) => {
        const teacherPayments = await Payment.findAll({
          where: {
            ...paymentWhereClause,
            group_id: {
              [Op.in]: teacher.groups.map(g => g.id)
            }
          },
          attributes: [
            [fn('COUNT', col('id')), 'total_payments'],
            [fn('SUM', literal('ABS(amount)')), 'total_revenue'],
            [fn('COUNT', fn('DISTINCT', col('student_id'))), 'total_paying_students']
          ],
          raw: true
        });

        const stats = teacherPayments[0] || {
          total_payments: 0,
          total_revenue: 0,
          total_paying_students: 0
        };

        // Расчет зарплаты (зарплата за студента * количество оплативших студентов)
        const salaryPerStudent = parseFloat(teacher.salary_per_student) || 0;
        const payingStudents = parseInt(stats.total_paying_students) || 0;
        const calculatedSalary = salaryPerStudent * payingStudents;

        return {
          teacher: {
            id: teacher.id,
            name: `${teacher.first_name} ${teacher.last_name} ${teacher.middle_name || ''}`.trim(),
            login: teacher.user?.login,
            salary_per_student: salaryPerStudent,
            hire_date: teacher.hire_date
          },
          groups: teacher.groups.map(group => ({
            id: group.id,
            name: group.name,
            course: group.course
          })),
          statistics: {
            total_payments: parseInt(stats.total_payments) || 0,
            total_revenue: parseFloat(stats.total_revenue) || 0,
            paying_students_count: payingStudents,
            calculated_salary: calculatedSalary
          }
        };
      }));

      // Общая статистика по всем учителям
      const totalStats = salaryReport.reduce((acc, teacher) => {
        acc.total_teachers++;
        acc.total_calculated_salary += teacher.statistics.calculated_salary;
        acc.total_paying_students += teacher.statistics.paying_students_count;
        acc.total_revenue += teacher.statistics.total_revenue;
        return acc;
      }, {
        total_teachers: 0,
        total_calculated_salary: 0,
        total_paying_students: 0,
        total_revenue: 0
      });

      res.json({
        success: true,
        data: {
          teachers: salaryReport,
          summary: totalStats,
          period: {
            start_date: start_date || null,
            end_date: end_date || null
          }
        }
      });
    } catch (error) {
      console.error('Ошибка получения отчета по зарплате учителей:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при получении отчета по зарплате'
      });
    }
  },

  // GET /api/reports/debtors - отчет по должникам (для модалки админа)
  getDebtorsReport: async (req, res) => {
    try {
      const { Op } = require('sequelize');

      console.log('Начинаем получение отчета по должникам...');

      // Студенты с отрицательным балансом ИЛИ со статусом должник
      const debtorStudents = await Student.findAll({
        where: {
          [Op.or]: [
            { balance: { [Op.lt]: 0 } }, // отрицательный баланс
            { status: 'debtor' }         // статус должник
          ]
        },
        attributes: ['id', 'first_name', 'last_name', 'phone', 'balance', 'status'],
        include: [
          {
            model: Group,
            as: 'groups',
            through: {
              where: { is_active: true },
              attributes: [] // исключаем атрибуты промежуточной таблицы
            },
            required: false, // LEFT JOIN вместо INNER JOIN
            attributes: ['id', 'name'],
            include: [{
              model: Course,
              as: 'course',
              required: false,
              attributes: ['id', 'name']
            }]
          }
        ]
      });

      console.log(`Найдено студентов-должников: ${debtorStudents.length}`);

      // Просроченные списания - с проверкой существования модели
      let overdueCharges = [];

      try {
        if (typeof MonthlyCharge !== 'undefined' && MonthlyCharge !== null) {
          overdueCharges = await MonthlyCharge.findAll({
            where: {
              status: 'pending',
              due_date: {
                [Op.lt]: new Date()
              }
            },
            include: [
              {
                model: Student,
                as: 'student',
                required: true,
                attributes: ['id', 'first_name', 'last_name', 'phone', 'balance']
              },
              {
                model: Group,
                as: 'group',
                required: false,
                attributes: ['id', 'name'],
                include: [{
                  model: Course,
                  as: 'course',
                  required: false,
                  attributes: ['id', 'name']
                }]
              }
            ],
            order: [['due_date', 'ASC']],
            limit: 50 // ограничиваем количество для производительности
          });

          console.log(`Найдено просроченных списаний: ${overdueCharges.length}`);
        } else {
          console.warn('MonthlyCharge модель не найдена');
        }
      } catch (chargeError) {
        console.error('Ошибка получения просроченных списаний:', chargeError);
        // Продолжаем выполнение без просроченных списаний
      }

      // Статистика
      const stats = {
        total_debtors: debtorStudents.length,
        overdue_charges_count: overdueCharges.length,
        total_debt_amount: Math.abs(
          debtorStudents
            .filter(student => student.balance < 0)
            .reduce((sum, student) => sum + parseFloat(student.balance), 0)
        )
      };

      console.log('Статистика должников:', stats);

      res.json({
        success: true,
        data: {
          debtor_students: debtorStudents,
          overdue_charges: overdueCharges,
          statistics: stats,
          has_urgent_issues: stats.total_debtors > 0 || stats.overdue_charges_count > 0
        }
      });

    } catch (error) {
      console.error('Ошибка получения отчета по должникам:', error);
      console.error('Stack trace:', error.stack);

      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при получении отчета по должникам',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // GET /api/reports/dashboard - общая статистика для дашборда
  getDashboardStats: async (req, res) => {
    try {
      const { Op, fn, col, literal } = require('sequelize');
      const today = new Date();
      const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

      console.log('Получение статистики дашборда...');

      // Статистика студентов
      const studentStats = await Student.findAll({
        attributes: [
          [fn('COUNT', col('*')), 'total_students'],
          [fn('COUNT', literal('CASE WHEN status = "active" THEN 1 END')), 'active_students'],
          [fn('COUNT', literal('CASE WHEN status = "debtor" THEN 1 END')), 'debtor_students'],
          [fn('COUNT', literal('CASE WHEN status = "inactive" THEN 1 END')), 'inactive_students'],
          [fn('SUM', col('balance')), 'total_balance']
        ],
        raw: true
      });

      console.log('Статистика студентов получена');

      // Доходы этого месяца
      const monthlyRevenue = await Payment.findAll({
        where: {
          payment_type: PAYMENT_TYPES.MONTHLY_CHARGE,
          payment_date: {
            [Op.gte]: thisMonth
          }
        },
        attributes: [
          [fn('COUNT', col('*')), 'payments_count'],
          [fn('SUM', literal('ABS(amount)')), 'total_revenue'],
          [fn('COUNT', fn('DISTINCT', col('student_id'))), 'paying_students']
        ],
        raw: true
      });

      console.log('Доходы этого месяца получены');

      // Доходы прошлого месяца для сравнения
      const lastMonthRevenue = await Payment.findAll({
        where: {
          payment_type: PAYMENT_TYPES.MONTHLY_CHARGE,
          payment_date: {
            [Op.gte]: lastMonth,
            [Op.lt]: thisMonth
          }
        },
        attributes: [
          [fn('SUM', literal('ABS(amount)')), 'last_month_revenue']
        ],
        raw: true
      });

      console.log('Доходы прошлого месяца получены');

      // Активные группы и курсы
      const groupStats = await Group.findAll({
        where: { is_active: true },
        attributes: [
          [fn('COUNT', col('*')), 'active_groups']
        ],
        raw: true
      });

      const courseStats = await Course.findAll({
        where: { is_active: true },
        attributes: [
          [fn('COUNT', col('*')), 'active_courses']
        ],
        raw: true
      });

      console.log('Статистика групп и курсов получена');

      // Комментарии (непрочитанные) - БЕЗОПАСНАЯ ПРОВЕРКА
      let commentStats = [{ unread_comments: 0, urgent_comments: 0 }];

      try {
        if (typeof StudentComment !== 'undefined' && StudentComment !== null) {
          commentStats = await StudentComment.findAll({
            where: { is_read: false },
            attributes: [
              [fn('COUNT', col('*')), 'unread_comments'],
              [fn('COUNT', literal('CASE WHEN is_urgent = true THEN 1 END')), 'urgent_comments']
            ],
            raw: true
          });
          console.log('Статистика комментариев получена');
        } else {
          console.warn('StudentComment модель не найдена, используем значения по умолчанию');
        }
      } catch (commentError) {
        console.error('Ошибка получения статистики комментариев:', commentError);
      }

      // Списания к обработке - БЕЗОПАСНАЯ ПРОВЕРКА
      let chargeStats = [{ pending_charges: 0, pending_amount: 0 }];

      try {
        if (typeof MonthlyCharge !== 'undefined' && MonthlyCharge !== null) {
          chargeStats = await MonthlyCharge.findAll({
            where: {
              status: 'pending'
            },
            attributes: [
              [fn('COUNT', col('*')), 'pending_charges'],
              [fn('SUM', col('amount')), 'pending_amount']
            ],
            raw: true
          });
          console.log('Статистика списаний получена');
        } else {
          console.warn('MonthlyCharge модель не найдена, используем значения по умолчанию');
        }
      } catch (chargeError) {
        console.error('Ошибка получения статистики списаний:', chargeError);
      }

      const currentRevenue = parseFloat(monthlyRevenue[0]?.total_revenue) || 0;
      const previousRevenue = parseFloat(lastMonthRevenue[0]?.last_month_revenue) || 0;
      const revenueGrowth = previousRevenue > 0 ?
        ((currentRevenue - previousRevenue) / previousRevenue * 100) : 0;

      console.log('Формируем ответ...');

      res.json({
        success: true,
        data: {
          students: {
            total: parseInt(studentStats[0]?.total_students) || 0,
            active: parseInt(studentStats[0]?.active_students) || 0,
            debtors: parseInt(studentStats[0]?.debtor_students) || 0,
            inactive: parseInt(studentStats[0]?.inactive_students) || 0,
            total_balance: parseFloat(studentStats[0]?.total_balance) || 0
          },
          revenue: {
            this_month: currentRevenue,
            last_month: previousRevenue,
            growth_percentage: Math.round(revenueGrowth * 100) / 100,
            payments_count: parseInt(monthlyRevenue[0]?.payments_count) || 0,
            paying_students: parseInt(monthlyRevenue[0]?.paying_students) || 0
          },
          system: {
            active_groups: parseInt(groupStats[0]?.active_groups) || 0,
            active_courses: parseInt(courseStats[0]?.active_courses) || 0,
            unread_comments: parseInt(commentStats[0]?.unread_comments) || 0,
            urgent_comments: parseInt(commentStats[0]?.urgent_comments) || 0,
            pending_charges: parseInt(chargeStats[0]?.pending_charges) || 0,
            pending_amount: parseFloat(chargeStats[0]?.pending_amount) || 0
          }
        }
      });

      console.log('Ответ отправлен успешно');

    } catch (error) {
      console.error('Ошибка получения статистики дашборда:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при получении статистики дашборда'
      });
    }
  }
};

module.exports = reportController;