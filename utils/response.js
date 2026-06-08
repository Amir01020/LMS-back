const { HTTP_STATUS } = require('./constants');

const sendSuccess = (res, data = null, message = null, status = HTTP_STATUS.OK) => {
  const body = { success: true };
  if (message) body.message = message;
  if (data !== null) body.data = data;
  return res.status(status).json(body);
};

const sendError = (res, message, status = HTTP_STATUS.BAD_REQUEST, errors = null) => {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(status).json(body);
};

module.exports = { sendSuccess, sendError };
