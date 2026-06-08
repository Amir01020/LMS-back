const { Op } = require('sequelize');
const { sequelize } = require('../models');
const {
  User, Group, GroupStudent, Lesson, Homework, HomeworkSubmission,
  Attendance, MentorRating, Order, PointTransaction
} = require('../models');
const PointsService = require('../services/pointsService');
const GroupAccessService = require('../services/groupAccessService');
const { USER_ROLES, SUBMISSION_STATUS, HTTP_STATUS } = require('../utils/constants');
const { sendSuccess, sendError } = require('../utils/response');

class StatsController {
  static async studentStats(req, res) {
    try {
      const { group_id } = req.query;
      let studentIds = [];

      if (req.user.role === USER_ROLES.STUDENT) {
        studentIds = [req.user.userId];
      } else if (group_id) {
        const links = await GroupStudent.findAll({ where: { group_id } });
        studentIds = links.map((l) => l.user_id);
      } else if (req.user.role === USER_ROLES.MENTOR) {
        const groupIds = await GroupAccessService.getMentorGroupIds(req.user.userId);
        const links = await GroupStudent.findAll({ where: { group_id: groupIds } });
        studentIds = links.map((l) => l.user_id);
      } else {
        const students = await User.findAll({ where: { role: USER_ROLES.STUDENT, is_active: true } });
        studentIds = students.map((s) => s.id);
      }

      const stats = await Promise.all(studentIds.map(async (studentId) => {
        const student = await User.findByPk(studentId, { attributes: ['id', 'name', 'email'] });
        const submissions = await HomeworkSubmission.findAll({ where: { student_id: studentId } });
        const reviewed = submissions.filter((s) => s.status === SUBMISSION_STATUS.REVIEWED);
        const points = await PointsService.getBalance(studentId);
        const attendances = await Attendance.findAll({ where: { student_id: studentId } });
        const present = attendances.filter((a) => a.is_present).length;

        const reviews = await HomeworkSubmission.findAll({
          where: { student_id: studentId, status: SUBMISSION_STATUS.REVIEWED },
          include: [{ model: require('../models').SubmissionReview, as: 'reviews' }]
        });

        let avgScore = 0;
        const scores = [];
        for (const sub of reviews) {
          if (sub.reviews?.length) scores.push(sub.reviews[0].score);
        }
        if (scores.length) avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

        return {
          student,
          submissionsTotal: submissions.length,
          submissionsReviewed: reviewed.length,
          averageScore: Math.round(avgScore * 100) / 100,
          points,
          attendanceRate: attendances.length
            ? Math.round((present / attendances.length) * 100)
            : 0
        };
      }));

      stats.sort((a, b) => b.points - a.points);
      return sendSuccess(res, { stats });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async mentorStats(req, res) {
    try {
      const where = { role: USER_ROLES.MENTOR, is_active: true };

      if (req.user.role === USER_ROLES.MENTOR) {
        where.id = req.user.userId;
      }

      const mentors = await User.findAll({ where, attributes: ['id', 'name', 'email'] });

      const stats = await Promise.all(mentors.map(async (mentor) => {
        const ratings = await MentorRating.findAll({ where: { mentor_id: mentor.id } });
        const avg = ratings.length
          ? ratings.reduce((s, r) => s + r.stars, 0) / ratings.length
          : 0;
        const highRatings = ratings.filter((r) => r.stars >= 4).length;

        return {
          mentor,
          ratingsCount: ratings.length,
          averageRating: Math.round(avg * 100) / 100,
          highRatingsCount: highRatings
        };
      }));

      stats.sort((a, b) => b.averageRating - a.averageRating);
      return sendSuccess(res, { stats });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async overview(req, res) {
    try {
      const activeStudents = await User.count({ where: { role: USER_ROLES.STUDENT, is_active: true } });
      const activeGroups = await Group.count({ where: { status: 'active' } });
      const lessonsCount = await Lesson.count();
      const homeworksCount = await Homework.count({ where: { status: 'published' } });
      const submissionsCount = await HomeworkSubmission.count();
      const ordersSpent = await Order.sum('total_price') || 0;

      const popularItems = await Order.findAll({
        attributes: [
          'item_id',
          [sequelize.fn('COUNT', sequelize.col('Order.id')), 'orderCount'],
          [sequelize.fn('SUM', sequelize.col('total_price')), 'totalSpent']
        ],
        group: ['item_id'],
        order: [[sequelize.literal('orderCount'), 'DESC']],
        limit: 5,
        raw: true
      });

      return sendSuccess(res, {
        activeStudents,
        activeGroups,
        lessonsCount,
        homeworksCount,
        submissionsCount,
        shopPointsSpent: ordersSpent,
        popularItems
      });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }
}

module.exports = StatsController;
