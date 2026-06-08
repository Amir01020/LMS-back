const { HTTP_STATUS } = require('../utils/constants');

const errorHandler = (err, req, res, next) => {
  console.error(err);
  res.status(err.status || HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: err.message || 'Внутренняя ошибка сервера'
  });
};

module.exports = errorHandler;
