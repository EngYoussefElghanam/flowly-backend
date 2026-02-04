const db = require("../util/db")
const sequelize = require("sequelize")

const customer = db.define('customer', {
    id: {
        type: sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true,
    },
    name: {
        type: sequelize.STRING,
        allowNull: false,
    },
    phone: {
        type: sequelize.STRING,
        allowNull: false,
    },
    city: {
        type: sequelize.STRING,
        allowNull: false,
    },
    address: {
        type: sequelize.TEXT,
        allowNull: false,
    },
    userId: {
        type: sequelize.INTEGER,
        allowNull: true
    },
    lastMarketingSentAt: {
        type: sequelize.DATE,
        allowNull: true
    }, totalSpent: {
        type: sequelize.DOUBLE,
        defaultValue: 0.0,
        allowNull: false
    },
    totalOrders: {
        type: sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
    },
    lastOrderDate: {
        type: sequelize.DATE,
        allowNull: true // It is null until they buy something
    },
    favoriteItem: {
        type: sequelize.STRING,
        allowNull: true // Can be null if they are new
    },
},
    {
        // Add this option block at the end
        indexes: [
            {
                unique: true,
                fields: ['userId', 'phone'] // 🔒 Scopes uniqueness to the owner
            }
        ]
    })

module.exports = customer