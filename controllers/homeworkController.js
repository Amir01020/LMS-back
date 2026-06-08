const {
  Homework, HomeworkAttachment, HomeworkSubmission, SubmissionAttachment,
  SubmissionReview, Group, User
} = require('../models');
const GroupAccessService = require('../services/groupAccessService');
const NotificationService = require('../services/notificationService');
const PointsService = require('../services/pointsService');
const {
  HOMEWORK_STATUS, SUBMISSION_STATUS, NOTIFICATION_TYPES,
  POINT_TRANSACTION_TYPE, USER_ROLES, HTTP_STATUS
} = require('../utils/constants');
const { sendSuccess, sendError } = require('../utils/response');

class HomeworkController {
  static async list(req, res) {
    try {
      const { lesson_id, group_id, status } = req.query;
      const where = {};
      if (lesson_id) where.lesson_id = lesson_id;
      if (group_id) where.group_id = group_id;
      if (status) where.status = status;

      if (req.user.role === USER_ROLES.STUDENT) {
        where.status = HOMEWORK_STATUS.PUBLISHED;
        where.is_visible = true;
      }

      const homeworks = await Homework.findAll({
        where,
        include: [
          { model: HomeworkAttachment, as: 'attachments' },
          { model: User, as: 'creator', attributes: ['id', 'name'] }
        ],
        order: [['deadline', 'ASC']]
      });

      return sendSuccess(res, { homeworks });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async create(req, res) {
    try {
      const {
        lesson_id, group_id, title, description, deadline, max_score, status, attachments
      } = req.body;

      if (!title || !deadline) {
        return sendError(res, 'Заголовок и дедлайн обязательны', HTTP_STATUS.BAD_REQUEST);
      }

      const homework = await Homework.create({
        lesson_id, group_id, title, description, deadline, max_score,
        status: status || HOMEWORK_STATUS.DRAFT,
        created_by: req.user.userId
      });

      if (attachments?.length) {
        await HomeworkAttachment.bulkCreate(
          attachments.map((a) => ({ ...a, homework_id: homework.id }))
        );
      }

      if (homework.status === HOMEWORK_STATUS.PUBLISHED && group_id) {
        const group = await Group.findByPk(group_id, {
          include: [{ model: User, as: 'students', attributes: ['id'] }]
        });
        if (group?.students?.length) {
          await NotificationService.createForUsers(
            group.students.map((s) => s.id),
            NOTIFICATION_TYPES.HOMEWORK_ASSIGNED,
            'Новое ДЗ',
            title,
            homework.id,
            'homework'
          );
        }
      }

      return sendSuccess(res, { homework }, 'ДЗ создано', HTTP_STATUS.CREATED);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async update(req, res) {
    try {
      const homework = await Homework.findByPk(req.params.id);
      if (!homework) return sendError(res, 'ДЗ не найдено', HTTP_STATUS.NOT_FOUND);
      await homework.update(req.body);
      return sendSuccess(res, { homework }, 'ДЗ обновлено');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async getSubmissions(req, res) {
    try {
      const submissions = await HomeworkSubmission.findAll({
        where: { homework_id: req.params.id },
        include: [
          { model: User, as: 'student', attributes: ['id', 'name', 'email'] },
          { model: SubmissionAttachment, as: 'attachments' },
          { model: SubmissionReview, as: 'reviews', include: [{ model: User, as: 'reviewer', attributes: ['id', 'name'] }] }
        ]
      });
      return sendSuccess(res, { submissions });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async submit(req, res) {
    try {
      if (req.user.role !== USER_ROLES.STUDENT) {
        return sendError(res, 'Только студенты могут сдавать ДЗ', HTTP_STATUS.FORBIDDEN);
      }

      const homework = await Homework.findByPk(req.params.id);
      if (!homework || homework.status !== HOMEWORK_STATUS.PUBLISHED) {
        return sendError(res, 'ДЗ недоступно', HTTP_STATUS.NOT_FOUND);
      }

      const { content, attachments } = req.body;
      const isOverdue = new Date() > new Date(homework.deadline);

      let submission = await HomeworkSubmission.findOne({
        where: { homework_id: homework.id, student_id: req.user.userId }
      });

      if (submission?.status === SUBMISSION_STATUS.REVIEWED) {
        return sendError(res, 'ДЗ уже проверено', HTTP_STATUS.BAD_REQUEST);
      }

      if (!submission) {
        submission = await HomeworkSubmission.create({
          homework_id: homework.id,
          student_id: req.user.userId,
          content,
          status: isOverdue ? SUBMISSION_STATUS.OVERDUE : SUBMISSION_STATUS.SUBMITTED,
          submitted_at: new Date()
        });
      } else {
        await submission.update({
          content,
          status: isOverdue ? SUBMISSION_STATUS.OVERDUE : SUBMISSION_STATUS.SUBMITTED,
          submitted_at: new Date()
        });
      }

      if (attachments?.length) {
        await SubmissionAttachment.destroy({ where: { submission_id: submission.id } });
        await SubmissionAttachment.bulkCreate(
          attachments.map((a) => ({ ...a, submission_id: submission.id }))
        );
      }

      return sendSuccess(res, { submission }, 'ДЗ сдано', HTTP_STATUS.CREATED);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async review(req, res) {
    try {
      const { score, comment, needs_revision } = req.body;
      const submission = await HomeworkSubmission.findByPk(req.params.submissionId, {
        include: [{ model: Homework, as: 'homework' }]
      });

      if (!submission) return sendError(res, 'Сдача не найдена', HTTP_STATUS.NOT_FOUND);

      const review = await SubmissionReview.create({
        submission_id: submission.id,
        reviewer_id: req.user.userId,
        score,
        comment,
        needs_revision: !!needs_revision
      });

      const newStatus = needs_revision
        ? SUBMISSION_STATUS.IN_PROGRESS
        : SUBMISSION_STATUS.REVIEWED;

      await submission.update({ status: newStatus });

      await NotificationService.create(
        submission.student_id,
        NOTIFICATION_TYPES.HOMEWORK_REVIEWED,
        'ДЗ проверено',
        `Оценка: ${score}/${submission.homework.max_score}`,
        submission.id,
        'submission'
      );

      if (!needs_revision && score >= submission.homework.max_score * 0.8) {
        await PointsService.addPoints(
          submission.student_id,
          10,
          POINT_TRANSACTION_TYPE.BONUS,
          'Высокая оценка за ДЗ',
          req.user.userId
        );
      }

      if (!needs_revision && submission.submitted_at <= submission.homework.deadline) {
        await PointsService.addPoints(
          submission.student_id,
          5,
          POINT_TRANSACTION_TYPE.EARNED,
          'Сдача ДЗ в срок',
          req.user.userId
        );
      }

      return sendSuccess(res, { review }, 'ДЗ проверено');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }
}

module.exports = HomeworkController;
