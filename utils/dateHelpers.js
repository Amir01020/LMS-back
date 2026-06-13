const formatDateISO = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getMonday = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(12, 0, 0, 0);
  return d;
};

const getCurrentWeekRange = () => {
  const monday = getMonday(new Date());
  const saturday = new Date(monday);
  saturday.setDate(saturday.getDate() + 5);
  return {
    monday: formatDateISO(monday),
    saturday: formatDateISO(saturday)
  };
};

const isSunday = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(`${dateStr}T12:00:00`);
  return d.getDay() === 0;
};

const getTodayKey = () => formatDateISO(new Date());

const getPeriodStartDate = (period) => {
  const now = new Date();
  const start = new Date(now);

  if (period === 'all') return null;

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
  formatDateISO,
  getMonday,
  getCurrentWeekRange,
  getTodayKey,
  isSunday,
  getPeriodStartDate,
  getCurrentYearMonth
};
