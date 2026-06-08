const express = require('express');
const v1Routes = require('./v1');

const router = express.Router();

router.use('/v1', v1Routes);

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'School LMS Platform API',
    version: '1.0.0',
    endpoints: {
      v1: '/api/v1',
      health: '/api/v1/health'
    }
  });
});

module.exports = router;
