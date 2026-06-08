const { MentorRating, User, GroupMentor } = require('../models');
const { getWeekNumber } = require('../utils/weekNumber');
const { USER_ROLES, HTTP_STATUS } = require('../utils/constants');
const { sendSuccess, sendError } = require('../utils/response');

class RatingController {
  static async rateMentor(req, res) {
    try {
      if (req.user.role !== USER_ROLES.STUDENT) {
        return sendError(res, 'Только студенты могут оценивать менторов', HTTP_STATUS.FORBIDDEN);
      }

      const { stars, review_text } = req.body;
      const mentorId = req.params.id;

      if (!stars || stars < 1 || stars > 5) {
        return sendError(res, 'Оценка от 1 до 5 обязательна', HTTP_STATUS.BAD_REQUEST);
      }

      const { GroupStudent } = require('../models');
      const mentorGroups = await GroupMentor.findAll({ where: { user_id: mentorId } });
      const mentorGroupIds = mentorGroups.map((g) => g.group_id);
      const studentLinks = await GroupStudent.findAll({ where: { user_id: req.user.userId } });
      const myGroupIds = studentLinks.map((l) => l.group_id);
      const isMyMentor = mentorGroupIds.some((id) => myGroupIds.includes(id));

      if (!isMyMentor) {
        return sendError(res, 'Можно оценить только своего ментора', HTTP_STATUS.FORBIDDEN);
      }

      const { weekNumber, year } = getWeekNumber();

      const existing = await MentorRating.findOne({
        where: {
          mentor_id: mentorId,
          student_id: req.user.userId,
          week_number: weekNumber,
          year
        }
      });

      if (existing) {
        return sendError(res, 'Вы уже оценили ментора на этой неделе', HTTP_STATUS.CONFLICT);
      }

      const rating = await MentorRating.create({
        mentor_id: mentorId,
        student_id: req.user.userId,
        stars,
        review_text,
        week_number: weekNumber,
        year
      });

      return sendSuccess(res, { rating }, 'Оценка сохранена', HTTP_STATUS.CREATED);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async getMentorRatings(req, res) {
    try {
      const mentorId = req.params.id;

      if (req.user.role === USER_ROLES.MENTOR && req.user.userId !== parseInt(mentorId)) {
        return sendError(res, 'Доступ запрещен', HTTP_STATUS.FORBIDDEN);
      }

      const ratings = await MentorRating.findAll({
        where: { mentor_id: mentorId },
        include: [{ model: User, as: 'student', attributes: ['id', 'name'] }],
        order: [['created_at', 'DESC']]
      });

      const avg = ratings.length
        ? ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length
        : 0;

      return sendSuccess(res, { ratings, averageRating: Math.round(avg * 100) / 100 });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }
}

module.exports = RatingController;
