const cronService = require('../services/cronService');

const cronController = {
  // GET /api/cron/status - получить статус всех задач
  getStatus: (req, res) => {
    try {
      const status = cronService.getStatus();
      
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Ошибка получения статуса cron-задач:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при получении статуса задач'
      });
    }
  },

  // POST /api/cron/start - запустить все задачи
  startService: (req, res) => {
    try {
      cronService.start();
      
      res.json({
        success: true,
        message: 'Сервис cron-задач запущен',
        data: cronService.getStatus()
      });
    } catch (error) {
      console.error('Ошибка запуска cron-задач:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка при запуске сервиса задач'
      });
    }
  },

  // POST /api/cron/stop - остановить все задачи
  stopService: (req, res) => {
    try {
      cronService.stop();
      
      res.json({
        success: true,
        message: 'Сервис cron-задач остановлен'
      });
    } catch (error) {
      console.error('Ошибка остановки cron-задач:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка при остановке сервиса задач'
      });
    }
  },

  // POST /api/cron/run/:taskName - запустить конкретную задачу вручную
  runTask: async (req, res) => {
    try {
      const { taskName } = req.params;
      
      await cronService.runTask(taskName);
      
      res.json({
        success: true,
        message: `Задача "${taskName}" выполнена успешно`
      });
    } catch (error) {
      console.error(`Ошибка выполнения задачи ${req.params.taskName}:`, error);
      
      if (error.message.includes('не найдена')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: `Ошибка при выполнении задачи: ${error.message}`
      });
    }
  }
};

module.exports = cronController;