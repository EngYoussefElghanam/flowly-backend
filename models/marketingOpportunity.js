const Sequelize = require("sequelize")
const db = require("../util/db")

const MarketingOpportunity = db.define('marketingOpportunities', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true,
    },
    type: {
        type: Sequelize.ENUM('WIN_BACK', 'VIP_REWARD'),
        allowNull: false,
    },
    aiMessage: {
        type: Sequelize.TEXT,
        allowNull: false,
    },
    status: {
        type: Sequelize.ENUM('PENDING', 'SENT', 'SNOOZED', 'DISMISSED'),
        defaultValue: 'PENDING'
    },
    snoozedUntil: {
        type: Sequelize.DATE,
        allowNull: true
    },
    userId: {
        type: Sequelize.INTEGER,
        allowNull: false, // 🔒 This forces the DB to reject orphans
    },
})
module.exports = MarketingOpportunity;