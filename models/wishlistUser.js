// wishlistUser.js
const { DataTypes } = require('sequelize');
const sequelize = require('./db');
const User = require('./user');
const WishlistItem = require('./wishlistItem');

const WishlistUser = sequelize.define('WishlistUser', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
});

module.exports = WishlistUser;
