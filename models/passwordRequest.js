// wishlistUser.js
const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const PasswordRequest = sequelize.define('PasswordRequest', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    user_id: { // Ajoutez cette clé étrangère
        type: DataTypes.INTEGER,
        references: {
            model: 'Users',
            key: 'id',
        },
    },
    user_email: {
        type: DataTypes.STRING(128),
        allowNull: false,
    },
    token: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    expirationDate: {
        type: DataTypes.DATE,
        allowNull: false,
    },
});

module.exports = PasswordRequest;
