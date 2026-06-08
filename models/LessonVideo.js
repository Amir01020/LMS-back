const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { VIDEO_STATUS } = require('../utils/constants');

const LessonVideo = sequelize.define('LessonVideo', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  lesson_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  video_url: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM(...Object.values(VIDEO_STATUS)),
    defaultValue: VIDEO_STATUS.PROCESSING
  },
  uploaded_by: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'lesson_videos'
});

module.exports = LessonVideo;
