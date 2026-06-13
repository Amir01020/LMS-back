const { Op } = require('sequelize');
const {
  User, Group, GroupStudent, GroupMentor, Lesson, Homework,
  HomeworkSubmission, SubmissionReview, Attendance, MentorRating
} = require('../models');
const PointsService = require('./pointsService');
const { USER_ROLES, SUBMISSION_STATUS, ENROLLMENT_STATUS } = require('../utils/constants');

const USER_ATTRS = ['id', 'name', 'email', 'role', 'avatar_url', 'phone'];

class StatsService {
  static calcPerformanceScore(stats) {
    const hwRate = stats.submissionsTotal
      ? (stats.submissionsReviewed / stats.submissionsTotal) * 100
      : 0;
    return Math.round(
      stats.points * 0.35 +
      stats.averageScore * 0.35 +
      hwRate * 0.30
    );
  }

  static async getBranchStudentIds(branchId) {
    const groups = await Group.findAll({
      where: { branch_id: branchId },
      attributes: ['id']
    });
    const groupIds = groups.map((g) => g.id);
    if (!groupIds.length) return [];

    const links = await GroupStudent.findAll({
      where: { group_id: groupIds, status: ENROLLMENT_STATUS.ACTIVE },
      attributes: ['user_id']
    });
    return [...new Set(links.map((l) => l.user_id))];
  }

  static async getAllActiveStudentIds() {
    const links = await GroupStudent.findAll({
      where: { status: ENROLLMENT_STATUS.ACTIVE },
      attributes: ['user_id']
    });
    return [...new Set(links.map((l) => l.user_id))];
  }

  static async getGroupLessonIds(groupId) {
    const lessons = await Lesson.findAll({
      where: { group_id: groupId },
      attributes: ['id']
    });
    return lessons.map((l) => l.id);
  }

  static async getGroupHomeworkIds(groupId) {
    const homeworks = await Homework.findAll({
      where: { group_id: groupId },
      attributes: ['id']
    });
    return homeworks.map((h) => h.id);
  }

  static async getStudentStats(studentId, groupId = null) {
    const student = await User.findByPk(studentId, { attributes: USER_ATTRS });
    if (!student) return null;

    const lessonIds = groupId ? await this.getGroupLessonIds(groupId) : null;
    const homeworkIds = groupId ? await this.getGroupHomeworkIds(groupId) : null;

    const submissionWhere = { student_id: studentId };
    if (homeworkIds?.length) {
      submissionWhere.homework_id = { [Op.in]: homeworkIds };
    }

    const submissions = await HomeworkSubmission.findAll({ where: submissionWhere });
    const reviewed = submissions.filter((s) => s.status === SUBMISSION_STATUS.REVIEWED);

    const reviews = await HomeworkSubmission.findAll({
      where: { ...submissionWhere, status: SUBMISSION_STATUS.REVIEWED },
      include: [{ model: SubmissionReview, as: 'reviews' }]
    });

    const scores = [];
    for (const sub of reviews) {
      if (sub.reviews?.length) scores.push(sub.reviews[0].score);
    }
    const averageScore = scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
      : 0;

    const attendanceWhere = { student_id: studentId };
    if (lessonIds?.length) {
      attendanceWhere.lesson_id = { [Op.in]: lessonIds };
    }
    const attendances = await Attendance.findAll({ where: attendanceWhere });
    const present = attendances.filter((a) => a.is_present).length;
    const attendanceRate = attendances.length
      ? Math.round((present / attendances.length) * 100)
      : 0;

    const points = await PointsService.getBalance(studentId);

    const stats = {
      user: student,
      role: USER_ROLES.STUDENT,
      submissionsTotal: submissions.length,
      submissionsReviewed: reviewed.length,
      averageScore,
      points,
      attendanceRate,
      lessonsAttended: present,
      lessonsTotal: attendances.length
    };

    stats.performanceScore = this.calcPerformanceScore(stats);
    return stats;
  }

  static async rankStudents(studentIds, groupId = null) {
    const stats = await Promise.all(
      studentIds.map((id) => this.getStudentStats(id, groupId))
    );

    return stats
      .filter(Boolean)
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }

  static async getStudentRankings(studentId) {
    const enrollment = await GroupStudent.findOne({
      where: { user_id: studentId, status: ENROLLMENT_STATUS.ACTIVE },
      order: [['joined_at', 'DESC']]
    });
    if (!enrollment) return null;

    const group = await Group.findByPk(enrollment.group_id);
    if (!group) return null;

    const groupLinks = await GroupStudent.findAll({
      where: { group_id: group.id, status: ENROLLMENT_STATUS.ACTIVE }
    });
    const groupStudentIds = groupLinks.map((l) => l.user_id);

    const branchStudentIds = group.branch_id
      ? await this.getBranchStudentIds(group.branch_id)
      : [];

    const companyStudentIds = await this.getAllActiveStudentIds();

    const [groupRanked, branchRanked, companyRanked] = await Promise.all([
      this.rankStudents(groupStudentIds, group.id),
      group.branch_id ? this.rankStudents(branchStudentIds) : [],
      this.rankStudents(companyStudentIds)
    ]);

    const stats = await this.getStudentStats(studentId, group.id);
    const rankInGroup = groupRanked.find((s) => s.user.id === studentId)?.rank || null;
    const rankInBranch = branchRanked.find((s) => s.user.id === studentId)?.rank || null;
    const rankInCompany = companyRanked.find((s) => s.user.id === studentId)?.rank || null;

    return {
      stats,
      group: { id: group.id, name: group.name },
      branch: group.branch_id ? { id: group.branch_id } : null,
      rankings: {
        inGroup: { rank: rankInGroup, total: groupRanked.length },
        inBranch: { rank: rankInBranch, total: branchRanked.length },
        inCompany: { rank: rankInCompany, total: companyRanked.length }
      },
      leaderboards: {
        group: groupRanked.slice(0, 10),
        branch: branchRanked.slice(0, 10),
        company: companyRanked.slice(0, 10)
      }
    };
  }

  static async getStaffPerformance(userId, branchId = null) {
    const user = await User.findByPk(userId, { attributes: USER_ATTRS });
    if (!user || ![USER_ROLES.MENTOR, USER_ROLES.SUPPORT].includes(user.role)) return null;

    let homeworkReviewsCount = 0;
    let avgReviewScore = 0;
    let avgStudentRating = 0;
    let ratingsCount = 0;
    let lessonsCount = 0;
    let completedLessons = 0;

    if (user.role === USER_ROLES.MENTOR) {
      const lessonWhere = { mentor_id: userId };
      if (branchId) {
        const branchGroups = await Group.findAll({
          where: { branch_id: branchId },
          attributes: ['id']
        });
        lessonWhere.group_id = { [Op.in]: branchGroups.map((g) => g.id) };
      }
      lessonsCount = await Lesson.count({ where: lessonWhere });
      completedLessons = await Lesson.count({ where: { ...lessonWhere, status: 'completed' } });

      const ratings = await MentorRating.findAll({ where: { mentor_id: userId } });
      ratingsCount = ratings.length;
      avgStudentRating = ratings.length
        ? Math.round((ratings.reduce((s, r) => s + r.stars, 0) / ratings.length) * 100) / 100
        : 0;
    }

    const reviews = await SubmissionReview.findAll({ where: { reviewer_id: userId } });
    homeworkReviewsCount = reviews.length;
    avgReviewScore = reviews.length
      ? Math.round((reviews.reduce((s, r) => s + parseFloat(r.score), 0) / reviews.length) * 100) / 100
      : 0;

    const performanceScore = Math.round(
      avgStudentRating * 25 +
      avgReviewScore * 0.5 +
      homeworkReviewsCount * 2 +
      completedLessons * 3
    );

    return {
      user,
      role: user.role,
      lessonsCount,
      completedLessons,
      ratingsCount,
      averageStudentRating: avgStudentRating,
      homeworkReviewsCount,
      averageReviewScore: avgReviewScore,
      performanceScore
    };
  }

  static async getStaffRankings(branchId = null) {
    const where = {
      role: { [Op.in]: [USER_ROLES.MENTOR, USER_ROLES.SUPPORT] },
      is_active: true
    };
    if (branchId) where.branch_id = branchId;

    const staff = await User.findAll({ where, attributes: ['id'] });
    const stats = await Promise.all(
      staff.map((s) => this.getStaffPerformance(s.id, branchId))
    );

    return stats
      .filter(Boolean)
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }

  static async getMentorStats(mentorId, groupId = null) {
    const mentor = await User.findByPk(mentorId, { attributes: USER_ATTRS });
    if (!mentor) return null;

    const lessonWhere = { mentor_id: mentorId };
    if (groupId) lessonWhere.group_id = groupId;

    const lessonsCount = await Lesson.count({ where: lessonWhere });
    const completedLessons = await Lesson.count({
      where: { ...lessonWhere, status: 'completed' }
    });

    let ratingsWhere = { mentor_id: mentorId };
    if (groupId) {
      const studentLinks = await GroupStudent.findAll({ where: { group_id: groupId } });
      const studentIds = studentLinks.map((l) => l.user_id);
      ratingsWhere = studentIds.length
        ? { mentor_id: mentorId, student_id: { [Op.in]: studentIds } }
        : { mentor_id: mentorId, student_id: -1 };
    }

    const ratings = await MentorRating.findAll({ where: ratingsWhere });
    const avgRating = ratings.length
      ? Math.round((ratings.reduce((s, r) => s + r.stars, 0) / ratings.length) * 100) / 100
      : 0;

    const groupHomeworkIds = groupId ? await this.getGroupHomeworkIds(groupId) : null;
    let reviewsCount = 0;
    if (groupHomeworkIds?.length) {
      const groupSubmissions = await HomeworkSubmission.findAll({
        where: { homework_id: { [Op.in]: groupHomeworkIds } },
        attributes: ['id']
      });
      const submissionIds = groupSubmissions.map((s) => s.id);
      if (submissionIds.length) {
        reviewsCount = await SubmissionReview.count({
          where: { reviewer_id: mentorId, submission_id: { [Op.in]: submissionIds } }
        });
      }
    } else {
      reviewsCount = await SubmissionReview.count({ where: { reviewer_id: mentorId } });
    }

    return {
      user: mentor,
      role: USER_ROLES.MENTOR,
      lessonsCount,
      completedLessons,
      ratingsCount: ratings.length,
      averageRating: avgRating,
      highRatingsCount: ratings.filter((r) => r.stars >= 4).length,
      homeworkReviewsCount: reviewsCount
    };
  }

  static async getGroupStats(groupId) {
    const group = await Group.findByPk(groupId, {
      attributes: ['id', 'name', 'status'],
      include: [{ model: User, as: 'mentors', attributes: USER_ATTRS }]
    });
    if (!group) return null;

    const studentLinks = await GroupStudent.findAll({
      where: { group_id: groupId, status: ENROLLMENT_STATUS.ACTIVE }
    });
    const studentIds = studentLinks.map((l) => l.user_id);

    const students = await this.rankStudents(studentIds, groupId)
      .then((ranked) => ranked.map((s) => ({ ...s, rankInGroup: s.rank })));

    const mentors = await Promise.all(
      (group.mentors || []).map((m) => this.getMentorStats(m.id, groupId))
    );

    return {
      group: { id: group.id, name: group.name, status: group.status },
      students,
      mentors: mentors.filter(Boolean)
    };
  }

  static async getMemberStats(groupId, userId) {
    const isStudent = await GroupStudent.findOne({
      where: { group_id: groupId, user_id: userId }
    });
    const isMentor = await GroupMentor.findOne({
      where: { group_id: groupId, user_id: userId }
    });

    if (!isStudent && !isMentor) return null;

    if (isStudent) {
      const rankings = await this.getStudentRankings(userId);
      if (!rankings) return null;
      return { ...rankings, rankInGroup: rankings.rankings.inGroup.rank };
    }

    const stats = await this.getMentorStats(userId, groupId);
    const group = await Group.findByPk(groupId, { attributes: ['id', 'name', 'status'] });
    return { group, ...stats, rankInGroup: null };
  }
}

module.exports = StatsService;
