// db.js
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('wishlist-app', 'root', '', {
    host: 'localhost',
    dialect: 'mysql',
});

module.exports = sequelize;
