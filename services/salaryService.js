const { SalaryPayment, User, Branch } = require('../models');
const { USER_ROLES, STAFF_ROLES } = require('../utils/constants');
const { getCurrentYearMonth } = require('../utils/dateHelpers');

class SalaryService {
  static async generateMonthlyPayments(year, month) {
    const staff = await User.findAll({
      where: {
        role: STAFF_ROLES.filter((r) => r !== USER_ROLES.SUPER_ADMIN),
        is_active: true
      },
      include: [{ model: Branch, as: 'branch', attributes: ['id', 'name'] }]
    });

    const results = [];

    for (const employee of staff) {
      if (!employee.salary || parseFloat(employee.salary) <= 0) continue;

      const [payment, created] = await SalaryPayment.findOrCreate({
        where: { user_id: employee.id, year, month },
        defaults: {
          branch_id: employee.branch_id,
          amount: employee.salary,
          is_paid: false
        }
      });

      if (!created && parseFloat(payment.amount) !== parseFloat(employee.salary)) {
        await payment.update({ amount: employee.salary, branch_id: employee.branch_id });
      }

      results.push(payment);
    }

    return results;
  }

  static async ensureCurrentMonthPayments() {
    const { year, month } = getCurrentYearMonth();
    return this.generateMonthlyPayments(year, month);
  }
}

module.exports = SalaryService;
