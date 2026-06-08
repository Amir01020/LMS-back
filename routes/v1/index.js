const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth'));
router.use('/users', require('./users'));
router.use('/directions', require('./directions'));
router.use('/groups', require('./groups'));
router.use('/lessons', require('./lessons'));
router.use('/homeworks', require('./homeworks'));
router.use('/students', require('./points'));
router.use('/shop', require('./shop'));
router.use('/mentors', require('./ratings'));
router.use('/stats', require('./stats'));
router.use('/notifications', require('./notifications'));
router.use('/branches', require('./branches'));
router.use('/finance', require('./finance'));

router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'OK',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  });
});

module.exports = router;
