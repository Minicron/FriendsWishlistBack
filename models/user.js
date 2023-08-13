// user.js
const { DataTypes } = require('sequelize');
const sequelize = require('./db');
const bcrypt = require('bcrypt');
const Wishlist = require('./wishlist');

const User = sequelize.define('User', {
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    email: {
        type: DataTypes.STRING(128),
        allowNull: false,
        unique: true,
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
});

User.addUser = async function (newUser, callback) {
    bcrypt.genSalt(10,(err,salt) => {
        bcrypt.hash(newUser.password, salt , (err, hash) =>{
            if(err) throw (err);

            newUser.password=hash;
            newUser.save(callback);
        });
    });
}

module.exports = User;
