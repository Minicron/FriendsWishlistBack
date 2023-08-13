// wishlistUser.js
const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const UserInvitation = sequelize.define('UserInvitation', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    wishlist_id: { // Ajoutez cette clé étrangère
        type: DataTypes.INTEGER,
        references: {
            model: 'Wishlists',
            key: 'id',
        },
    },
    user_email: {
        type: DataTypes.STRING(128),
        allowNull: false,
        unique: true,
    },
    token: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    expirationDate: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    isAccepted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    }
});

module.exports = UserInvitation;
