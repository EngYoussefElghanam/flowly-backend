const Sequelize = require("sequelize");
const db = require("../util/db");

const OrderItem = db.define("orderItem", {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true,
    },
    quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    // SNAPSHOT 1: The price you sold it for at that moment
    priceAtPurchase: {
        type: Sequelize.DOUBLE,
        allowNull: false
    },
    // SNAPSHOT 2: The cost of the item at that moment
    // (Crucial so future cost changes don't ruin old profit reports)
    costAtPurchase: {
        type: Sequelize.DOUBLE,
        allowNull: false
    }
});

module.exports = OrderItem;