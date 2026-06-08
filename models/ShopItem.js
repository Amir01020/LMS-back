const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { SHOP_ITEM_STATUS } = require('../utils/constants');

const ShopItem = sequelize.define('ShopItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  image_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  price: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  stock: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM(...Object.values(SHOP_ITEM_STATUS)),
    defaultValue: SHOP_ITEM_STATUS.ACTIVE
  }
}, {
  tableName: 'shop_items'
});

module.exports = ShopItem;
