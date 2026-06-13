require('dotenv').config();
const {
  sequelize, syncDatabase, User, Branch, Direction, Group,
  GroupMentor, GroupStudent, Lesson, Homework, HomeworkSubmission,
  SubmissionReview, Attendance, MentorRating, PointTransaction,
  BranchIncome, BranchBudget, SalaryPayment, StudentFreezeRequest
} = require('../models');
const AuthService = require('../services/authService');
const BranchAccessService = require('../services/branchAccessService');
const { migrate } = require('./migrateSuperAdmin');
const {
  USER_ROLES, GROUP_STATUS, LESSON_STATUS, HOMEWORK_STATUS,
  SUBMISSION_STATUS, POINT_TRANSACTION_TYPE,
  ENROLLMENT_STATUS, FREEZE_REQUEST_STATUS
} = require('../utils/constants');

const PASSWORD = '1111';
const avatar = (s) => `https://i.pravatar.cc/150?u=${s}`;

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const monthsAgo = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
};

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const formatDateISO = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getMondayOf = (ref = new Date()) => {
  const d = new Date(ref);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
};

// Пн/Ср/Пт и Вт/Чт/Сб — воскресенье выходной
const MON_WED_FRI = [1, 3, 5];
const TUE_THU_SAT = [2, 4, 6];

const TIME_SLOTS = [
  { start: '09:00:00', end: '10:30:00' },
  { start: '10:30:00', end: '12:00:00' },
  { start: '14:00:00', end: '15:30:00' },
  { start: '15:30:00', end: '17:00:00' }
];

const buildLessonDates = (useMonWedFri, lessonCount) => {
  const weekdays = useMonWedFri ? MON_WED_FRI : TUE_THU_SAT;
  const monday = getMondayOf();
  const dates = [];
  // Сначала текущая и соседние недели, чтобы уроки были видны в расписании
  const weekOrder = [-1, 0, -2, 1, -3, 2];

  for (const week of weekOrder) {
    for (const wd of weekdays) {
      if (dates.length >= lessonCount) break;
      const d = new Date(monday);
      d.setDate(monday.getDate() + week * 7 + (wd - 1));
      dates.push(formatDateISO(d));
    }
  }

  return dates.slice(0, lessonCount).sort();
};

const todayKey = () => formatDateISO(new Date());

const DIRECTIONS_DATA = [
  { name: 'Веб-разработка', description: 'HTML, CSS, JavaScript, Vue', color: '#1A93EA', icon: 'pi-code' },
  { name: 'Робототехника', description: 'Arduino, Python, AI', color: '#072C46', icon: 'pi-microchip-ai' },
  { name: 'Дизайн', description: 'UI/UX, Figma, графика', color: '#EC4899', icon: 'pi-palette' },
  { name: 'Мобильная разработка', description: 'Android, iOS, Flutter', color: '#10B981', icon: 'pi-mobile' }
];

const BRANCHES_DATA = [
  { key: 'maksim', name: 'Максим горький', address: 'г. Ташкент, ул. Максим Горького, 25', phone: '+998711000001', tuition: 1400000 },
  { key: 'chilanzar', name: 'Чиланзар', address: 'г. Ташкент, Чиланзарский р-н, ул. Бунёдкор, 12', phone: '+998711000002', tuition: 1500000 },
  { key: 'sergeli', name: 'Сергели', address: 'г. Ташкент, Сергелийский р-н, ул. Навои, 45', phone: '+998711000003', tuition: 1300000 },
  { key: 'mirobad', name: 'Мирабад', address: 'г. Ташкент, Мирабадский р-н, ул. Амира Темура, 78', phone: '+998711000004', tuition: 1800000 }
];

const STUDENT_NAMES = [
  'Алишер Каримов', 'Диана Саидова', 'Жасур Турсунов', 'Малика Рахимова', 'Нодир Умаров',
  'Севара Исмаилова', 'Бехруз Ахмедов', 'Камила Юсупова', 'Рустам Назаров', 'Зухра Абдуллаева',
  'Ислом Рахимов', 'Нигора Тошпулатова', 'Шахзод Мирзаев', 'Лайло Хакимова', 'Фаррух Бобоев',
  'Азиза Каримова', 'Даврон Эргашев', 'Мадина Султанова', 'Отабек Турдиев', 'Сабина Рахимова'
];

const GROUP_SUFFIX = ['утро', 'день', 'вечер', 'интенсив'];

let studentCounter = 0;

const createUser = async (data) => AuthService.createUser({ password: PASSWORD, ...data }).then((u) => User.findByPk(u.id));

const seedLessonsAndHomework = async ({ group, mentor, students, supportStaff, groupIndex, branchIndex }) => {
  const titles = ['Введение', 'Основы', 'Практика 1', 'Практика 2', 'Углубление', 'Проект', 'Повторение', 'Итог'];
  const useMonWedFri = groupIndex % 2 === 0;
  const dates = buildLessonDates(useMonWedFri, 8);
  const slot = TIME_SLOTS[(branchIndex * 4 + groupIndex) % TIME_SLOTS.length];
  const lessons = [];
  const today = todayKey();

  for (let i = 0; i < 8; i++) {
    const lessonDate = dates[i];
    const isPast = lessonDate < today;
    const lesson = await Lesson.create({
      group_id: group.id,
      mentor_id: mentor.id,
      title: `${titles[i]} — ${group.name}`,
      description: `Урок ${i + 1}`,
      date: lessonDate,
      start_time: slot.start,
      end_time: slot.end,
      type: i % 2 === 0 ? 'online' : 'offline',
      status: isPast ? LESSON_STATUS.COMPLETED : LESSON_STATUS.SCHEDULED
    });
    lessons.push(lesson);
  }

  const completedLessons = lessons.filter((l) => l.status === LESSON_STATUS.COMPLETED);
  for (const lesson of completedLessons) {
    for (const student of students) {
      if (student._enrollmentStatus === ENROLLMENT_STATUS.FROZEN) continue;
      await Attendance.create({
        lesson_id: lesson.id,
        student_id: student.id,
        is_present: Math.random() > 0.15
      });
    }
  }

  for (let i = 0; i < Math.min(4, completedLessons.length); i++) {
    const hw = await Homework.create({
      lesson_id: completedLessons[i].id,
      group_id: group.id,
      title: `ДЗ ${i + 1} — ${group.name}`,
      description: 'Домашнее задание',
      deadline: new Date(Date.now() + (i < 2 ? -86400000 * 5 : 86400000 * 7)),
      max_score: 100,
      status: HOMEWORK_STATUS.PUBLISHED,
      created_by: mentor.id,
      is_visible: true
    });

    for (let si = 0; si < students.length; si++) {
      if (students[si]._enrollmentStatus !== ENROLLMENT_STATUS.ACTIVE) continue;
      const score = 65 + si * 5 + randomInt(0, 15);
      const reviewed = i < 3 || si % 2 === 0;
      const submission = await HomeworkSubmission.create({
        homework_id: hw.id,
        student_id: students[si].id,
        content: `Решение ${students[si].name}`,
        status: reviewed ? SUBMISSION_STATUS.REVIEWED : SUBMISSION_STATUS.SUBMITTED,
        submitted_at: new Date()
      });
      if (reviewed) {
        const reviewer = si % 2 === 0 ? mentor : supportStaff;
        await SubmissionReview.create({
          submission_id: submission.id,
          reviewer_id: reviewer.id,
          score,
          comment: score >= 85 ? 'Отлично' : 'Хорошо',
          reviewed_at: new Date()
        });
      }
    }
  }

  for (let si = 0; si < students.length; si++) {
    if (students[si]._enrollmentStatus !== ENROLLMENT_STATUS.ACTIVE) continue;
    await PointTransaction.create({
      student_id: students[si].id,
      amount: 30 + si * 12 + randomInt(0, 25),
      type: POINT_TRANSACTION_TYPE.EARNED,
      description: 'Баллы за обучение',
      created_by: mentor.id
    });
    await MentorRating.findOrCreate({
      where: {
        mentor_id: mentor.id,
        student_id: students[si].id,
        week_number: Math.ceil(new Date().getDate() / 7),
        year: new Date().getFullYear()
      },
      defaults: { stars: 3 + (si % 3), review_text: 'Хороший ментор' }
    });
  }
};

const seed = async () => {
  try {
    await sequelize.authenticate();
    await migrate();
    await syncDatabase();

    const superAdmin = await User.findOne({ where: { role: USER_ROLES.SUPER_ADMIN } });
    if (!superAdmin) {
      console.error('❌ Сначала запустите: npm run db:reset');
      process.exitCode = 1;
      return;
    }

    const existingBranch = await Branch.findOne({ where: { name: BRANCHES_DATA[0].name } });
    if (existingBranch) {
      console.log('ℹ️  Данные уже существуют. Запустите: npm run db:reset:seed');
      return;
    }

    const directions = [];
    for (const d of DIRECTIONS_DATA) {
      directions.push(await Direction.create(d));
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const summary = { branches: [], totalIncome: 0 };

    for (let bi = 0; bi < BRANCHES_DATA.length; bi++) {
      const bc = BRANCHES_DATA[bi];
      const branch = await Branch.create({
        name: bc.name,
        address: bc.address,
        phone: bc.phone
      });

      const managers = [];
      for (let i = 1; i <= 3; i++) {
        const m = await createUser({
          name: `Менеджер ${i} — ${bc.name}`,
          email: `manager${i}.${bc.key}@school.local`,
          role: USER_ROLES.MANAGER,
          phone: `+99890${randomInt(1000000, 9999999)}`,
          avatar_url: avatar(`mgr${i}-${bc.key}`),
          branch_id: branch.id,
          salary: 5000000
        });
        await BranchAccessService.syncUserBranches(m.id, [branch.id]);
        managers.push(m);
      }

      const mentors = [];
      for (let i = 1; i <= 4; i++) {
        mentors.push(await createUser({
          name: `Ментор ${i} — ${bc.name}`,
          email: `mentor${i}.${bc.key}@school.local`,
          role: USER_ROLES.MENTOR,
          phone: `+99891${randomInt(1000000, 9999999)}`,
          avatar_url: avatar(`mentor${i}-${bc.key}`),
          branch_id: branch.id,
          salary: 3500000 + i * 300000
        }));
      }

      const supports = [];
      for (let i = 1; i <= 4; i++) {
        supports.push(await createUser({
          name: `Саппорт ${i} — ${bc.name}`,
          email: `support${i}.${bc.key}@school.local`,
          role: USER_ROLES.SUPPORT,
          phone: `+99893${randomInt(1000000, 9999999)}`,
          avatar_url: avatar(`support${i}-${bc.key}`),
          branch_id: branch.id,
          salary: 2500000
        }));
      }

      for (let m = 0; m < 3; m++) {
        const bm = month - m <= 0 ? month - m + 12 : month - m;
        const by = month - m <= 0 ? year - 1 : year;
        await BranchBudget.create({
          branch_id: branch.id,
          year: by,
          month: bm,
          allocated_amount: 12000000 + randomInt(0, 4000000),
          created_by: managers[0].id
        });
      }

      let branchIncome = 0;
      const groups = [];

      for (let di = 0; di < directions.length; di++) {
        const direction = directions[di];
        const mentor = mentors[di % 4];
        const supportStaff = supports[di % 4];

        const group = await Group.create({
          name: `${direction.name} — ${GROUP_SUFFIX[di]}`,
          direction_id: direction.id,
          branch_id: branch.id,
          status: GROUP_STATUS.ACTIVE,
          start_date: monthsAgo(4),
          end_date: null
        });
        groups.push(group);

        await GroupMentor.create({ group_id: group.id, user_id: mentor.id });
        if (di < 2) {
          await GroupMentor.create({ group_id: group.id, user_id: mentors[(di + 1) % 4].id });
        }

        const students = [];
        for (let si = 0; si < 5; si++) {
          studentCounter += 1;
          const name = STUDENT_NAMES[(studentCounter - 1) % STUDENT_NAMES.length];
          const monthsStudying = 2 + (si % 4);
          const monthsPaid = Math.max(1, monthsStudying - (si % 2));

          const student = await createUser({
            name,
            email: `student${studentCounter}.${bc.key}@school.local`,
            role: USER_ROLES.STUDENT,
            avatar_url: avatar(`stu${studentCounter}-${bc.key}`)
          });

          let enrollmentStatus = ENROLLMENT_STATUS.ACTIVE;
          if (si === 4 && di === 0) enrollmentStatus = ENROLLMENT_STATUS.FROZEN;
          if (si === 3 && di === 1) enrollmentStatus = ENROLLMENT_STATUS.LEFT;

          student._enrollmentStatus = enrollmentStatus;
          student._monthsPaid = monthsPaid;
          student._monthsStudying = monthsStudying;

          await GroupStudent.create({
            group_id: group.id,
            user_id: student.id,
            joined_at: new Date(monthsAgo(monthsStudying)),
            status: enrollmentStatus,
            frozen_at: enrollmentStatus === ENROLLMENT_STATUS.FROZEN ? new Date() : null,
            left_at: enrollmentStatus === ENROLLMENT_STATUS.LEFT ? new Date() : null
          });

          for (let mp = 0; mp < monthsPaid; mp++) {
            const amount = bc.tuition + randomInt(-80000, 80000);
            const income = await BranchIncome.create({
              branch_id: branch.id,
              student_id: student.id,
              amount,
              income_date: mp === 0 ? daysAgo(0) : monthsAgo(monthsStudying - mp),
              description: `Оплата обучения — ${name}`,
              created_by: managers[0].id
            });
            branchIncome += parseFloat(income.amount);
          }

          students.push(student);
        }

        await seedLessonsAndHomework({
          group, mentor, students, supportStaff, groupIndex: di, branchIndex: bi
        });

        if (di === 0 && students[1]?._enrollmentStatus === ENROLLMENT_STATUS.ACTIVE) {
          await StudentFreezeRequest.create({
            student_id: students[1].id,
            group_id: group.id,
            branch_id: branch.id,
            reason: 'Поездка за границу',
            status: FREEZE_REQUEST_STATUS.PENDING
          });
        }
      }

      for (const staff of [...mentors, ...supports, ...managers]) {
        await SalaryPayment.create({
          user_id: staff.id,
          branch_id: branch.id,
          year,
          month,
          amount: staff.salary || 3000000,
          is_paid: Math.random() > 0.25,
          paid_at: Math.random() > 0.25 ? new Date() : null,
          paid_by: managers[0].id,
          notes: `Зарплата — ${staff.name}`
        });
      }

      summary.totalIncome += branchIncome;
      summary.branches.push({
        name: bc.name,
        id: branch.id,
        managers: managers.length,
        mentors: mentors.length,
        supports: supports.length,
        groups: groups.length,
        income: branchIncome
      });
    }

    console.log('\n✅ Демо-данные созданы!\n');
    console.log('Филиалы:', summary.branches.length);
    summary.branches.forEach((b) => {
      console.log(`  ${b.name} (id:${b.id}) — ${b.groups} групп, доход: ${b.income.toLocaleString('ru-RU')} сум`);
    });
    console.log(`\nИтого доход: ${summary.totalIncome.toLocaleString('ru-RU')} сум`);
    console.log('\nНаправления:', DIRECTIONS_DATA.map((d) => d.name).join(', '));
    console.log('\nВход (пароль 1111):');
    console.log('  Super Admin:', process.env.SUPER_ADMIN_EMAIL || 'superadmin@school.local');
    console.log('  Менеджер:    manager1.chilanzar@school.local');
    console.log('  Ментор:      mentor1.chilanzar@school.local');
    console.log('  Саппорт:     support1.chilanzar@school.local');
    console.log('  Студент:     student1.maksim@school.local');
    console.log('');
  } catch (error) {
    console.error('❌ Ошибка seed:', error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

seed();
