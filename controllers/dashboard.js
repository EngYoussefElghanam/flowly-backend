const Order = require("../models/orders")

exports.getDashboardStats = async (req, res, next) => {
    try {
        const orders = await Order.findAll({ where: { userId: req.userId } })
        let totalRevenue = 0
        let totalProfit = 0
        const totalOrders = orders.length
        for (const order of orders) {
            totalRevenue += order.totalAmount
            totalProfit += order.totalProfit
        }
        res.status(200).json({
            totalRevenue: totalRevenue,
            totalOrders: totalOrders,
            totalProfit: totalProfit,
            averageOrderValue: totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : 0
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error });
    }
}