const Sequelize = require('sequelize');

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 5432),
        dialect: "postgres",
        logging: false,
        dialectOptions: {
            ssl: { require: true, rejectUnauthorized: false },
        },
        pool: { max: 5, min: 0, idle: 10000, acquire: 30000 },
    }
);

module.exports = sequelize;