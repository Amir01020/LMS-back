const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  MANAGER: 'manager',
  MENTOR: 'mentor',
  SUPPORT: 'support',
  STUDENT: 'student'
};

const STAFF_ROLES = [
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.MANAGER,
  USER_ROLES.MENTOR,
  USER_ROLES.SUPPORT
];

const MANAGEMENT_ROLES = [USER_ROLES.SUPER_ADMIN, USER_ROLES.MANAGER];

const ROLES_CREATABLE_BY_MANAGER = [
  USER_ROLES.STUDENT
];

const ROLES_CREATABLE_BY_SUPER_ADMIN = [
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.MANAGER,
  USER_ROLES.MENTOR,
  USER_ROLES.SUPPORT
];

const GROUP_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  PAUSED: 'paused'
};

const ENROLLMENT_STATUS = {
  ACTIVE: 'active',
  FROZEN: 'frozen',
  LEFT: 'left'
};

const FREEZE_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

const LESSON_TYPE = {
  ONLINE: 'online',
  OFFLINE: 'offline'
};

const LESSON_STATUS = {
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

const RECURRENCE_PATTERN = {
  WEEKLY: 'weekly',
  CUSTOM: 'custom'
};

const VIDEO_STATUS = {
  PROCESSING: 'processing',
  AVAILABLE: 'available',
  ERROR: 'error'
};

const HOMEWORK_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived'
};

const SUBMISSION_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  SUBMITTED: 'submitted',
  OVERDUE: 'overdue',
  REVIEWED: 'reviewed'
};

const POINT_TRANSACTION_TYPE = {
  EARNED: 'earned',
  SPENT: 'spent',
  BONUS: 'bonus',
  MANUAL: 'manual'
};

const SHOP_ITEM_STATUS = {
  ACTIVE: 'active',
  HIDDEN: 'hidden'
};

const ORDER_STATUS = {
  PENDING: 'pending',
  ISSUED: 'issued',
  CANCELLED: 'cancelled'
};

const NOTIFICATION_TYPES = {
  HOMEWORK_ASSIGNED: 'homework_assigned',
  HOMEWORK_REVIEWED: 'homework_reviewed',
  HOMEWORK_DEADLINE: 'homework_deadline',
  LESSON_CHANGED: 'lesson_changed',
  POINTS_AWARDED: 'points_awarded',
  ORDER_STATUS: 'order_status',
  LESSON_COMMENT: 'lesson_comment'
};

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500
};

const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Неверный email или пароль',
  ACCESS_DENIED: 'Доступ запрещен',
  TOKEN_REQUIRED: 'Токен авторизации обязателен',
  INVALID_TOKEN: 'Недействительный токен',
  USER_NOT_FOUND: 'Пользователь не найден',
  USER_EXISTS: 'Пользователь с таким email уже существует',
  GROUP_NOT_FOUND: 'Группа не найдена',
  LESSON_NOT_FOUND: 'Урок не найден',
  HOMEWORK_NOT_FOUND: 'Домашнее задание не найдено',
  INSUFFICIENT_POINTS: 'Недостаточно баллов',
  VALIDATION_ERROR: 'Ошибка валидации данных',
  SERVER_ERROR: 'Внутренняя ошибка сервера'
};

const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Успешная авторизация',
  CREATED: 'Запись успешно создана',
  UPDATED: 'Запись успешно обновлена',
  DELETED: 'Запись успешно удалена'
};

module.exports = {
  USER_ROLES,
  STAFF_ROLES,
  MANAGEMENT_ROLES,
  ROLES_CREATABLE_BY_MANAGER,
  ROLES_CREATABLE_BY_SUPER_ADMIN,
  GROUP_STATUS,
  ENROLLMENT_STATUS,
  FREEZE_REQUEST_STATUS,
  LESSON_TYPE,
  LESSON_STATUS,
  RECURRENCE_PATTERN,
  VIDEO_STATUS,
  HOMEWORK_STATUS,
  SUBMISSION_STATUS,
  POINT_TRANSACTION_TYPE,
  SHOP_ITEM_STATUS,
  ORDER_STATUS,
  NOTIFICATION_TYPES,
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES
};
