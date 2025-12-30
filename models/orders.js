const Sequelize = require("sequelize"); // Standard is to capitalize the Library
const db = require("../util/db");

// Use "order" (Singular) - Sequelize will automatically make the table "orders" (Plural)
const Order = db.define("order", {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true,
    },
    trackingNumber: {
        type: Sequelize.STRING,
        allowNull: true
    },
    status: {
        type: Sequelize.ENUM("NEW", "PACKED", "WITH_COURIER", "DELIVERED", "CANCELLED", "RETURNED"),
        defaultValue: "NEW",
        allowNull: false,
    },
    totalAmount: {
        type: Sequelize.DOUBLE,
        allowNull: false,
    },
    totalProfit: {
        type: Sequelize.DOUBLE,
        allowNull: false,
    },
    courierName: {
        type: Sequelize.STRING
    },
    notes: {
        type: Sequelize.TEXT
    }
});

module.exports = Order;