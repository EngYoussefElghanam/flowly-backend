const Sequelize = require('sequelize');
const db = require('../util/db');


const PendingUser = db.define('pendingUser', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true,
    },
    // We store all the signup info here temporarily
    name: { type: Sequelize.STRING, allowNull: false },
    email: { type: Sequelize.STRING, allowNull: false },
    password: { type: Sequelize.STRING, allowNull: false }, // Store HASHED password
    phone: { type: Sequelize.STRING, allowNull: true },
    role: { type: Sequelize.STRING, defaultValue: 'OWNER' },
    ownerId: { type: Sequelize.INTEGER, allowNull: true },
    // The Verification Logic
    verificationCode: { type: Sequelize.STRING, allowNull: false },
    expiresAt: { type: Sequelize.DATE, allowNull: false }
});

module.exports = PendingUser;