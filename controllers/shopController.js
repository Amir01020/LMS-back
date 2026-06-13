const path = require('path');
const fs = require('fs');
const {
  ShopItem, Order, User, BranchShopItem, Branch
} = require('../models');
const { Op } = require('sequelize');
const { buildShopImageUrl, shopImageFilenameFromUrl } = require('../utils/shopImageUrl');
const { normalizeMediaUrl } = require('../utils/mediaUrl');
const { SHOP_IMAGE_DIR } = require('../middleware/uploadShopImage');
const PointsService = require('../services/pointsService');
const NotificationService = require('../services/notificationService');
const BranchAccessService = require('../services/branchAccessService');
const {
  SHOP_ITEM_STATUS, ORDER_STATUS, NOTIFICATION_TYPES, USER_ROLES, HTTP_STATUS
} = require('../utils/constants');
const { sendSuccess, sendError } = require('../utils/response');

class ShopController {
  static mapItem(item) {
    const json = item.toJSON ? item.toJSON() : item;
    return {
      ...json,
      image_url: normalizeMediaUrl(json.image_url)
    };
  }

  static async listItems(req, res) {
    try {
      if (req.user.role === USER_ROLES.STUDENT) {
        const branchId = await BranchAccessService.getStudentBranchId(req.user.userId);
        if (!branchId) {
          return sendSuccess(res, { items: [] });
        }

        const allocations = await BranchShopItem.findAll({
          where: { branch_id: branchId, quantity: { [Op.gt]: 0 } },
          include: [{ model: ShopItem, as: 'item', where: { status: SHOP_ITEM_STATUS.ACTIVE } }]
        });

        const items = allocations.map((row) => ({
          ...ShopController.mapItem(row.item),
          branchStock: row.quantity,
          allocationId: row.id
        }));

        return sendSuccess(res, { items });
      }

      if (req.user.role === USER_ROLES.SUPER_ADMIN) {
        const items = await ShopItem.findAll({ order: [['name', 'ASC']] });
        return sendSuccess(res, { items: items.map(ShopController.mapItem) });
      }

      const branchIds = req.user.branchIds?.length
        ? req.user.branchIds
        : (req.user.branchId ? [req.user.branchId] : []);

      if (!branchIds.length) {
        return sendSuccess(res, { items: [] });
      }

      const allocations = await BranchShopItem.findAll({
        where: { branch_id: branchIds, quantity: { [Op.gt]: 0 } },
        include: [{ model: ShopItem, as: 'item' }]
      });

      const items = allocations.map((row) => ({
        ...ShopController.mapItem(row.item),
        branchStock: row.quantity,
        branch_id: row.branch_id
      }));

      return sendSuccess(res, { items });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async createItem(req, res) {
    try {
      const item = await ShopItem.create(req.body);
      return sendSuccess(res, { item: ShopController.mapItem(item) }, 'Товар создан', HTTP_STATUS.CREATED);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async updateItem(req, res) {
    try {
      const item = await ShopItem.findByPk(req.params.id);
      if (!item) return sendError(res, 'Товар не найден', HTTP_STATUS.NOT_FOUND);
      await item.update(req.body);
      return sendSuccess(res, { item: ShopController.mapItem(item) }, 'Товар обновлен');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async deleteItem(req, res) {
    try {
      const item = await ShopItem.findByPk(req.params.id);
      if (!item) return sendError(res, 'Товар не найден', HTTP_STATUS.NOT_FOUND);
      await item.destroy();
      return sendSuccess(res, null, 'Товар удален');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async uploadItemImage(req, res) {
    try {
      if (!req.file) {
        return sendError(res, 'Файл изображения обязателен (поле image)', HTTP_STATUS.BAD_REQUEST);
      }

      const item = await ShopItem.findByPk(req.params.id);
      if (!item) return sendError(res, 'Товар не найден', HTTP_STATUS.NOT_FOUND);

      const oldFilename = shopImageFilenameFromUrl(item.image_url);
      if (oldFilename && !oldFilename.startsWith('http')) {
        const oldPath = path.join(SHOP_IMAGE_DIR, oldFilename);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      const imageUrl = buildShopImageUrl(req, req.file.filename);
      await item.update({ image_url: imageUrl });

      return sendSuccess(res, { item: ShopController.mapItem(item) }, 'Фото товара обновлено');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async listBranchAllocations(req, res) {
    try {
      const branchId = parseInt(req.params.branchId);
      const allocations = await BranchShopItem.findAll({
        where: { branch_id: branchId },
        include: [{ model: ShopItem, as: 'item' }],
        order: [[{ model: ShopItem, as: 'item' }, 'name', 'ASC']]
      });
      return sendSuccess(res, { allocations });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async setBranchAllocations(req, res) {
    try {
      const branchId = parseInt(req.params.branchId);
      const branch = await Branch.findByPk(branchId);
      if (!branch || !branch.is_active) {
        return sendError(res, 'Филиал не найден', HTTP_STATUS.NOT_FOUND);
      }

      const { allocations } = req.body;
      if (!Array.isArray(allocations)) {
        return sendError(res, 'allocations должен быть массивом', HTTP_STATUS.BAD_REQUEST);
      }

      const results = [];
      for (const row of allocations) {
        const { shop_item_id, quantity } = row;
        if (!shop_item_id) continue;

        const [allocation] = await BranchShopItem.findOrCreate({
          where: { branch_id: branchId, shop_item_id },
          defaults: { quantity: quantity || 0 }
        });

        await allocation.update({ quantity: quantity || 0 });
        results.push(allocation);
      }

      return sendSuccess(res, { allocations: results }, 'Выделение товаров сохранено');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async createOrder(req, res) {
    try {
      if (req.user.role !== USER_ROLES.STUDENT) {
        return sendError(res, 'Только студенты могут покупать', HTTP_STATUS.FORBIDDEN);
      }

      const { item_id, quantity = 1 } = req.body;
      const branchId = await BranchAccessService.getStudentBranchId(req.user.userId);
      if (!branchId) {
        return sendError(res, 'Студент не привязан к филиалу', HTTP_STATUS.BAD_REQUEST);
      }

      const item = await ShopItem.findByPk(item_id);
      if (!item || item.status !== SHOP_ITEM_STATUS.ACTIVE) {
        return sendError(res, 'Товар недоступен', HTTP_STATUS.NOT_FOUND);
      }

      const allocation = await BranchShopItem.findOne({
        where: { branch_id: branchId, shop_item_id: item_id }
      });

      if (!allocation || allocation.quantity < quantity) {
        return sendError(res, 'Недостаточно товара в филиале', HTTP_STATUS.BAD_REQUEST);
      }

      const totalPrice = item.price * quantity;
      await PointsService.spendPoints(
        req.user.userId,
        totalPrice,
        `Покупка: ${item.name}`,
        req.user.userId
      );

      const order = await Order.create({
        student_id: req.user.userId,
        item_id,
        quantity,
        total_price: totalPrice,
        branch_id: branchId,
        status: ORDER_STATUS.PENDING
      });

      await allocation.update({ quantity: allocation.quantity - quantity });

      const staffIds = await BranchAccessService.getBranchStaffIds(branchId);
      if (staffIds.length) {
        const student = await User.findByPk(req.user.userId, { attributes: ['name'] });
        await NotificationService.createForUsers(
          staffIds,
          NOTIFICATION_TYPES.ORDER_STATUS,
          'Новый заказ в магазине',
          `${student.name} заказал «${item.name}»`,
          order.id,
          'order'
        );
      }

      return sendSuccess(res, { order }, 'Заказ создан', HTTP_STATUS.CREATED);
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async listOrders(req, res) {
    try {
      const where = {};

      if (req.user.role === USER_ROLES.STUDENT) {
        where.student_id = req.user.userId;
      } else if (req.user.role === USER_ROLES.MANAGER || req.user.role === USER_ROLES.SUPPORT) {
        const branchIds = req.user.branchIds?.length
          ? req.user.branchIds
          : (req.user.branchId ? [req.user.branchId] : []);
        if (branchIds.length) {
          where.branch_id = branchIds.length === 1 ? branchIds[0] : { [Op.in]: branchIds };
        }
      } else if (req.user.role === USER_ROLES.SUPER_ADMIN && req.query.branch_id) {
        where.branch_id = req.query.branch_id;
      }

      const orders = await Order.findAll({
        where,
        include: [
          { model: ShopItem, as: 'item' },
          { model: User, as: 'student', attributes: ['id', 'name', 'email'] },
          { model: Branch, as: 'branch', attributes: ['id', 'name'] }
        ],
        order: [['created_at', 'DESC']]
      });

      return sendSuccess(res, { orders });
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async issueOrder(req, res) {
    try {
      const order = await Order.findByPk(req.params.id);
      if (!order) return sendError(res, 'Заказ не найден', HTTP_STATUS.NOT_FOUND);

      if (req.user.role === USER_ROLES.MANAGER || req.user.role === USER_ROLES.SUPPORT) {
        const branchIds = req.user.branchIds?.length
          ? req.user.branchIds
          : (req.user.branchId ? [req.user.branchId] : []);
        if (order.branch_id && branchIds.length && !branchIds.includes(order.branch_id)) {
          return sendError(res, 'Доступ запрещен', HTTP_STATUS.FORBIDDEN);
        }
      }

      await order.update({ status: ORDER_STATUS.ISSUED, issued_at: new Date() });

      await NotificationService.create(
        order.student_id,
        NOTIFICATION_TYPES.ORDER_STATUS,
        'Заказ выдан',
        'Ваш заказ из магазина выдан',
        order.id,
        'order'
      );

      return sendSuccess(res, { order }, 'Заказ выдан');
    } catch (error) {
      return sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }
}

module.exports = ShopController;
