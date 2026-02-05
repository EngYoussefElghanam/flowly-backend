const Order = require('../models/orders')
const Product = require('../models/products')
const OrderItem = require('../models/order_items')
const sequelize = require('sequelize')

exports.getDashboardStats = async (req, res, next) => {
    try {
        const userId = req.userId;

        // 1. Existing Logic: Totals (Revenue, Profit, Count)
        const orders = await Order.findAll({ where: { userId: userId } });

        let totalRevenue = 0;
        let totalProfit = 0;
        const totalOrders = orders.length;

        for (const order of orders) {
            totalRevenue += parseFloat(order.totalAmount || 0);
            totalProfit += parseFloat(order.totalProfit || 0);
        }

        // 2. New Logic: Low Stock Item (Threshold: 15)
        const lowStockThreshold = 15; // 🔒 Hardcoded limit for now

        const lowStockProduct = await Product.findOne({
            where: { userId: userId },
            order: [['stockQuantity', 'ASC']], // Get the absolute lowest item
            attributes: ['name', 'stockQuantity']
        });

        // Default text
        let lowStockText = "All Stock Good";

        // Only alert if we actually found a product AND its stock is <= 15
        if (lowStockProduct && lowStockProduct.stockQuantity <= lowStockThreshold) {
            lowStockText = `${lowStockProduct.name} (${lowStockProduct.stockQuantity} units)`;
        }

        // 3. New Logic: Top Selling Item
        const topSellingVariant = await OrderItem.findOne({
            attributes: [
                [sequelize.fn('SUM', sequelize.col('quantity')), 'totalSold']
            ],
            include: [
                {
                    model: Order,
                    attributes: [],
                    where: { userId: userId }
                },
                {
                    model: Product,
                    attributes: ['name']
                }
            ],
            group: ['productId', 'product.id', 'product.name'],
            order: [[sequelize.fn('SUM', sequelize.col('quantity')), 'DESC']],
        });

        let topSellingText = "N/A";
        if (topSellingVariant && topSellingVariant.product) {
            const qty = topSellingVariant.getDataValue('totalSold');
            topSellingText = `${topSellingVariant.product.name} (${qty} sold)`;
        }

        // 4. Send Response
        res.status(200).json({
            totalRevenue: totalRevenue.toFixed(2),
            totalOrders: totalOrders,
            totalProfit: totalProfit.toFixed(2),
            averageOrderValue: totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : "0.00",
            lowStockItem: lowStockText,
            topSellingItem: topSellingText
        });

    } catch (error) {
        console.log("Dashboard Stats Error:", error);
        res.status(500).json({ error: error.message });
    }
}