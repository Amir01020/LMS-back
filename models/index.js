const { sequelize } = require('../config/database');

const User = require('./User');
const RefreshToken = require('./RefreshToken');
const PasswordResetToken = require('./PasswordResetToken');
const Direction = require('./Direction');
const Group = require('./Group');
const GroupMentor = require('./GroupMentor');
const GroupStudent = require('./GroupStudent');
const Lesson = require('./Lesson');
const LessonRecurrence = require('./LessonRecurrence');
const LessonVideo = require('./LessonVideo');
const LessonMaterial = require('./LessonMaterial');
const LessonComment = require('./LessonComment');
const Homework = require('./Homework');
const HomeworkAttachment = require('./HomeworkAttachment');
const HomeworkSubmission = require('./HomeworkSubmission');
const SubmissionAttachment = require('./SubmissionAttachment');
const SubmissionReview = require('./SubmissionReview');
const MentorRating = require('./MentorRating');
const PointTransaction = require('./PointTransaction');
const ShopItem = require('./ShopItem');
const Order = require('./Order');
const Notification = require('./Notification');
const Attendance = require('./Attendance');
const Branch = require('./Branch');
const BranchBudget = require('./BranchBudget');
const BranchIncome = require('./BranchIncome');
const SalaryPayment = require('./SalaryPayment');
const BranchShopItem = require('./BranchShopItem');
const UserBranch = require('./UserBranch');
const StudentFreezeRequest = require('./StudentFreezeRequest');

const models = {
  User,
  RefreshToken,
  PasswordResetToken,
  Direction,
  Group,
  GroupMentor,
  GroupStudent,
  Lesson,
  LessonRecurrence,
  LessonVideo,
  LessonMaterial,
  LessonComment,
  Homework,
  HomeworkAttachment,
  HomeworkSubmission,
  SubmissionAttachment,
  SubmissionReview,
  MentorRating,
  PointTransaction,
  ShopItem,
  Order,
  Notification,
  Attendance,
  Branch,
  BranchBudget,
  BranchIncome,
  SalaryPayment,
  BranchShopItem,
  UserBranch,
  StudentFreezeRequest
};

const setupAssociations = () => {
  User.hasMany(RefreshToken, { foreignKey: 'user_id', as: 'refreshTokens' });
  RefreshToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  User.hasMany(PasswordResetToken, { foreignKey: 'user_id', as: 'resetTokens' });
  PasswordResetToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  Direction.hasMany(Group, { foreignKey: 'direction_id', as: 'groups' });
  Group.belongsTo(Direction, { foreignKey: 'direction_id', as: 'direction' });

  Group.belongsToMany(User, {
    through: GroupMentor,
    foreignKey: 'group_id',
    otherKey: 'user_id',
    as: 'mentors'
  });
  User.belongsToMany(Group, {
    through: GroupMentor,
    foreignKey: 'user_id',
    otherKey: 'group_id',
    as: 'mentorGroups'
  });

  Group.belongsToMany(User, {
    through: GroupStudent,
    foreignKey: 'group_id',
    otherKey: 'user_id',
    as: 'students'
  });
  User.belongsToMany(Group, {
    through: GroupStudent,
    foreignKey: 'user_id',
    otherKey: 'group_id',
    as: 'studentGroups'
  });

  Group.hasMany(Lesson, { foreignKey: 'group_id', as: 'lessons' });
  Lesson.belongsTo(Group, { foreignKey: 'group_id', as: 'group' });

  User.hasMany(Lesson, { foreignKey: 'mentor_id', as: 'lessons' });
  Lesson.belongsTo(User, { foreignKey: 'mentor_id', as: 'mentor' });

  Lesson.hasOne(LessonRecurrence, { foreignKey: 'lesson_id', as: 'recurrence' });
  LessonRecurrence.belongsTo(Lesson, { foreignKey: 'lesson_id', as: 'lesson' });

  Lesson.hasMany(LessonVideo, { foreignKey: 'lesson_id', as: 'videos' });
  LessonVideo.belongsTo(Lesson, { foreignKey: 'lesson_id', as: 'lesson' });
  User.hasMany(LessonVideo, { foreignKey: 'uploaded_by', as: 'uploadedVideos' });
  LessonVideo.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploader' });

  Lesson.hasMany(LessonMaterial, { foreignKey: 'lesson_id', as: 'materials' });
  LessonMaterial.belongsTo(Lesson, { foreignKey: 'lesson_id', as: 'lesson' });

  Lesson.hasMany(LessonComment, { foreignKey: 'lesson_id', as: 'comments' });
  LessonComment.belongsTo(Lesson, { foreignKey: 'lesson_id', as: 'lesson' });
  User.hasMany(LessonComment, { foreignKey: 'author_id', as: 'lessonComments' });
  LessonComment.belongsTo(User, { foreignKey: 'author_id', as: 'author' });
  LessonComment.belongsTo(LessonComment, { foreignKey: 'parent_id', as: 'parent' });
  LessonComment.hasMany(LessonComment, { foreignKey: 'parent_id', as: 'replies' });

  Lesson.hasMany(Homework, { foreignKey: 'lesson_id', as: 'homeworks' });
  Homework.belongsTo(Lesson, { foreignKey: 'lesson_id', as: 'lesson' });
  Group.hasMany(Homework, { foreignKey: 'group_id', as: 'homeworks' });
  Homework.belongsTo(Group, { foreignKey: 'group_id', as: 'group' });
  User.hasMany(Homework, { foreignKey: 'created_by', as: 'createdHomeworks' });
  Homework.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

  Homework.hasMany(HomeworkAttachment, { foreignKey: 'homework_id', as: 'attachments' });
  HomeworkAttachment.belongsTo(Homework, { foreignKey: 'homework_id', as: 'homework' });

  Homework.hasMany(HomeworkSubmission, { foreignKey: 'homework_id', as: 'submissions' });
  HomeworkSubmission.belongsTo(Homework, { foreignKey: 'homework_id', as: 'homework' });
  User.hasMany(HomeworkSubmission, { foreignKey: 'student_id', as: 'submissions' });
  HomeworkSubmission.belongsTo(User, { foreignKey: 'student_id', as: 'student' });

  HomeworkSubmission.hasMany(SubmissionAttachment, { foreignKey: 'submission_id', as: 'attachments' });
  SubmissionAttachment.belongsTo(HomeworkSubmission, { foreignKey: 'submission_id', as: 'submission' });

  HomeworkSubmission.hasMany(SubmissionReview, { foreignKey: 'submission_id', as: 'reviews' });
  SubmissionReview.belongsTo(HomeworkSubmission, { foreignKey: 'submission_id', as: 'submission' });
  User.hasMany(SubmissionReview, { foreignKey: 'reviewer_id', as: 'reviews' });
  SubmissionReview.belongsTo(User, { foreignKey: 'reviewer_id', as: 'reviewer' });

  User.hasMany(MentorRating, { foreignKey: 'mentor_id', as: 'receivedRatings' });
  User.hasMany(MentorRating, { foreignKey: 'student_id', as: 'givenRatings' });
  MentorRating.belongsTo(User, { foreignKey: 'mentor_id', as: 'mentor' });
  MentorRating.belongsTo(User, { foreignKey: 'student_id', as: 'student' });

  User.hasMany(PointTransaction, { foreignKey: 'student_id', as: 'pointTransactions' });
  PointTransaction.belongsTo(User, { foreignKey: 'student_id', as: 'student' });
  User.hasMany(PointTransaction, { foreignKey: 'created_by', as: 'createdPointTransactions' });
  PointTransaction.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

  User.hasMany(Order, { foreignKey: 'student_id', as: 'orders' });
  Order.belongsTo(User, { foreignKey: 'student_id', as: 'student' });
  ShopItem.hasMany(Order, { foreignKey: 'item_id', as: 'orders' });
  Order.belongsTo(ShopItem, { foreignKey: 'item_id', as: 'item' });

  User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
  Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  Lesson.hasMany(Attendance, { foreignKey: 'lesson_id', as: 'attendances' });
  Attendance.belongsTo(Lesson, { foreignKey: 'lesson_id', as: 'lesson' });
  User.hasMany(Attendance, { foreignKey: 'student_id', as: 'attendances' });
  Attendance.belongsTo(User, { foreignKey: 'student_id', as: 'student' });

  Branch.hasMany(User, { foreignKey: 'branch_id', as: 'staff' });
  User.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });

  Branch.hasMany(Group, { foreignKey: 'branch_id', as: 'groups' });
  Group.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });

  Branch.hasMany(BranchBudget, { foreignKey: 'branch_id', as: 'budgets' });
  BranchBudget.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });
  User.hasMany(BranchBudget, { foreignKey: 'created_by', as: 'createdBudgets' });
  BranchBudget.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

  Branch.hasMany(BranchIncome, { foreignKey: 'branch_id', as: 'incomes' });
  BranchIncome.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });
  User.hasMany(BranchIncome, { foreignKey: 'student_id', as: 'branchIncomes' });
  BranchIncome.belongsTo(User, { foreignKey: 'student_id', as: 'student' });
  User.hasMany(BranchIncome, { foreignKey: 'created_by', as: 'recordedIncomes' });
  BranchIncome.belongsTo(User, { foreignKey: 'created_by', as: 'recorder' });

  User.hasMany(SalaryPayment, { foreignKey: 'user_id', as: 'salaryPayments' });
  SalaryPayment.belongsTo(User, { foreignKey: 'user_id', as: 'employee' });
  Branch.hasMany(SalaryPayment, { foreignKey: 'branch_id', as: 'salaryPayments' });
  SalaryPayment.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });
  User.hasMany(SalaryPayment, { foreignKey: 'paid_by', as: 'processedSalaryPayments' });
  SalaryPayment.belongsTo(User, { foreignKey: 'paid_by', as: 'payer' });

  User.belongsToMany(Branch, {
    through: UserBranch,
    foreignKey: 'user_id',
    otherKey: 'branch_id',
    as: 'branches'
  });
  Branch.belongsToMany(User, {
    through: UserBranch,
    foreignKey: 'branch_id',
    otherKey: 'user_id',
    as: 'assignedStaff'
  });

  Branch.hasMany(BranchShopItem, { foreignKey: 'branch_id', as: 'shopAllocations' });
  BranchShopItem.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });
  ShopItem.hasMany(BranchShopItem, { foreignKey: 'shop_item_id', as: 'branchAllocations' });
  BranchShopItem.belongsTo(ShopItem, { foreignKey: 'shop_item_id', as: 'item' });

  Order.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });
  Branch.hasMany(Order, { foreignKey: 'branch_id', as: 'orders' });

  User.hasMany(StudentFreezeRequest, { foreignKey: 'student_id', as: 'freezeRequests' });
  StudentFreezeRequest.belongsTo(User, { foreignKey: 'student_id', as: 'student' });
  StudentFreezeRequest.belongsTo(Group, { foreignKey: 'group_id', as: 'group' });
  StudentFreezeRequest.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });
  User.hasMany(StudentFreezeRequest, { foreignKey: 'reviewed_by', as: 'reviewedFreezeRequests' });
  StudentFreezeRequest.belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewer' });
};

setupAssociations();

const syncDatabase = async (force = false) => {
  const dialect = sequelize.getDialect();
  const alter = process.env.DB_ALTER_SYNC === 'true';

  if (!force) {
    try {
      const { migrate } = require('../scripts/migrateSuperAdmin');
      await migrate();
    } catch (error) {
      console.warn('⚠️ Миграция super_admin:', error.message);
    }
  }

  if (force && dialect === 'mysql') {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  }

  await sequelize.sync({ force, alter: alter && !force });

  if (force && dialect === 'mysql') {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  if (force) {
    console.log('✅ База данных синхронизирована (пересоздание таблиц)');
  } else if (alter) {
    console.log('✅ База данных синхронизирована (alter mode)');
  } else {
    console.log('✅ База данных синхронизирована');
  }
};

module.exports = {
  sequelize,
  models,
  syncDatabase,
  ...models
};
