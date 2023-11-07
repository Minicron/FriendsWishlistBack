// wishlist.js
const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const Wishlist = sequelize.define('Wishlist', {
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    isClosed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    }
});

Wishlist.addWishlist = function (newWishlist, callback) {
    newWishlist.save(callback);
}

// Add user to a wishlist
Wishlist.addUser = async function (wishlistId, userId) {
    try {
        const wishlist = await Wishlist.findByPk(wishlistId);
        if (!wishlist) {
            throw new Error('Wishlist not found');
        }
        await wishlist.addUser(userId);
        return true;
    } catch (err) {
        throw err;
    }
};

module.exports = Wishlist;
