const db = require("../util/db")
const sequelize = require("sequelize")

const product = db.define("product", {
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
    costPrice: {
        type: sequelize.DOUBLE,
        allowNull: false,
    },
    sellPrice: {
        type: sequelize.DOUBLE,
        allowNull: false,
    },
    stockQuantity: {
        type: sequelize.INTEGER,
        allowNull: false,
    }
})

module.exports = product