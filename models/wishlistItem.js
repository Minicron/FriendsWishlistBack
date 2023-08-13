// wishlistItem.js
const { DataTypes } = require('sequelize');
const sequelize = require('./db');
const User = require('./user');

const WishlistItem = sequelize.define('WishlistItem', {
    itemName: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    description: {
        type: DataTypes.TEXT,
    },
    url: {
        type: DataTypes.STRING,
    },
    bought: {
        type: DataTypes.BOOLEAN,
    },
    wishlistUser_id: { // Ajoutez cette clé étrangère
        type: DataTypes.INTEGER,
        references: {
            model: 'WishlistUsers',
            key: 'id',
        },
    },
    reserved: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    reservedBy: {
        type: DataTypes.INTEGER,
        references: {
            model: 'users',
            key: 'id',
        },
    },
});

WishlistItem.addItem = function (newItem, callback) {
    newItem.save(callback);
}

module.exports = WishlistItem;
