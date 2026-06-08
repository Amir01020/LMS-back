const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BranchShopItem = sequelize.define('BranchShopItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  branch_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  shop_item_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'branch_shop_items',
  indexes: [
    { unique: true, fields: ['branch_id', 'shop_item_id'] },
    { fields: ['branch_id'] }
  ]
});

module.exports = BranchShopItem;
