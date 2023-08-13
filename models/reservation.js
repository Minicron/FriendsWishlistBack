// reservation.js
const { DataTypes } = require('sequelize');
const sequelize = require('./db');
const User = require('./user');
const WishlistItem = require('./wishlistItem');

const Reservation = sequelize.define('Reservation', {
    reserved: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    reservingUser_id: { // Ajoutez cette clé étrangère
        type: DataTypes.INTEGER,
        references: {
            model: 'Users',
            key: 'id',
        },
    },
    wishlistItem_id: { // Ajoutez cette clé étrangère
        type: DataTypes.INTEGER,
        references: {
            model: 'WishlistItems',
            key: 'id',
        },
    },
});

// Method to reserve an item
Reservation.reserveItem = function (newReservation, callback) {
    newReservation.save(callback);
}

// Method to unreserve an item
Reservation.unreserveItem = function (reservationId, callback) {
    Reservation.destroy({
        where: {
            id: reservationId
        }
    }).then(callback);
}

module.exports = Reservation;
