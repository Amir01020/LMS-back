const getPeriodStartDate = (period) => {
  const now = new Date();
  const start = new Date(now);

  switch (period) {
    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'quarter':
      start.setMonth(start.getMonth() - 3);
      start.setHours(0, 0, 0, 0);
      break;
    case 'year':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
    default:
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
  }

  return start;
};

const getCurrentYearMonth = () => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
};

module.exports = {
  getPeriodStartDate,
  getCurrentYearMonth
};
