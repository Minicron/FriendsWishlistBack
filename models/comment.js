// comment.js
const { DataTypes } = require('sequelize');
const sequelize = require('./db');
const User = require('./user');
const WishlistItem = require('./wishlistItem');

const Comment = sequelize.define('Comment', {
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    userId: { // Ajoutez cette clé étrangère
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Users',
            key: 'id',
        },
    },
    itemId: { // Ajoutez cette clé étrangère
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'WishlistItems',
            key: 'id',
        },
    },
});

// Méthode pour ajouter un commentaire
Comment.add = function (newComment, callback) {
    newComment.save(callback);
}

// Méthode pour obtenir tous les commentaires pour un item
Comment.getCommentsForItem = function (itemId, callback) {
    Comment.findAll({
        where: {
            itemId: itemId
        },
        order: [['createdAt', 'DESC']],
        include: User // Cela ajoutera les informations de l'utilisateur à chaque commentaire
    }).then(callback);
}

module.exports = Comment;
