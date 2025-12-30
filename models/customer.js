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
        unique: true,
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
    }
})

module.exports = customer