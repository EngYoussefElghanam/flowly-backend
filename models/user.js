const sequelize = require("sequelize")
const db = require("../util/db")

const user = db.define('user', {
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
    email: {
        type: sequelize.STRING,
        allowNull: false,
        unique: true,
    },
    password: {
        type: sequelize.STRING,
        allowNull: false
    },
    phone: {
        type: sequelize.STRING,
        allowNull: true,
    },
    defaultCourier: {
        type: sequelize.STRING
    },
    role: {
        type: sequelize.ENUM("EMPLOYEE", "OWNER"),
        defaultValue: "EMPLOYEE",
        allowNull: false
    },
    ownerId: {
        type: sequelize.INTEGER,
        allowNull: true,
    },
    inactiveThreshold: {
        type: sequelize.INTEGER,
        defaultValue: 30,
        allowNull: false,
    },
    vipOrderThreshold: {
        type: sequelize.INTEGER,
        defaultValue: 5,
        allowNull: false
    }
})

module.exports = user;