const sequelize = require('./db');
const User = require('./user');
const Wishlist = require('./wishlist');
const WishlistUser = require('./wishlistUser');
const WishlistItem = require('./wishlistItem');
const Reservation = require('./reservation');
const UserInvitation = require('./userInvitation');

// Création des associations entre les modèles
User.hasMany(Wishlist, { foreignKey: {name: 'auteur_id', allowNull: false,} }); // Un utilisateur peut avoir plusieurs Wishlists
Wishlist.belongsTo(User, { foreignKey: 'auteur_id' });
Wishlist.belongsToMany(User, { through: WishlistUser, foreignKey: 'wishlist_id' }); // Une Wishlist peut avoir plusieurs utilisateurs
User.belongsToMany(Wishlist, { through: WishlistUser })

// Each wishlistUser has many wishlistItems
WishlistUser.hasMany(WishlistItem, { foreignKey: 'wishlistUser_id' });
WishlistItem.belongsTo(WishlistUser, { foreignKey: 'wishlistUser_id' });

WishlistItem.hasMany(Reservation, { foreignKey: 'wishlistItem_id' });
Reservation.belongsTo(WishlistItem, { foreignKey: 'wishlistItem_id' });

User.hasMany(Reservation, { foreignKey: 'reservingUser_id' });
Reservation.belongsTo(User, { foreignKey: 'reservingUser_id' });

User.hasMany(WishlistItem, { as: 'ReservedItems', foreignKey: 'reservedBy' });
WishlistItem.belongsTo(User, { as: 'ReservingUser', foreignKey: 'reservedBy' });

// Every invitation is linked to a wishlist
Wishlist.hasMany(UserInvitation, { foreignKey: 'wishlist_id' });
UserInvitation.belongsTo(Wishlist, { foreignKey: 'wishlist_id' });

(async () => {
    try {
        await sequelize.sync();
        console.log('Database synchronized successfully');
    } catch (error) {
        console.error('Error syncing database:', error);
    }
})();

module.exports = {
    sequelize,
    User,
    Wishlist,
    WishlistUser,
    WishlistItem,
    Reservation
}