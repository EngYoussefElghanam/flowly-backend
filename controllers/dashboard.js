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
            // Ensure we handle string/number conversion safely
            totalRevenue += parseFloat(order.totalAmount || 0);
            totalProfit += parseFloat(order.totalProfit || 0);
        }

        // 2. New Logic: Low Stock Item (Lowest Stock Quantity)
        const lowStockProduct = await Product.findOne({
            where: { userId: userId },
            order: [['stockQuantity', 'ASC']], // Lowest first
            attributes: ['name', 'stockQuantity']
        });

        // Format the string for the UI: "Coffee Beans (2 left)"
        const lowStockText = lowStockProduct
            ? `${lowStockProduct.name} (${lowStockProduct.stockQuantity} units)`
            : "All Stock Good";

        // 3. New Logic: Top Selling Item (Sum of Quantities from OrderItems)
        // We need to join OrderItem -> Order to ensure we only count THIS user's sales
        const topSellingVariant = await OrderItem.findOne({
            attributes: [
                [sequelize.fn('SUM', sequelize.col('quantity')), 'totalSold']
            ],
            include: [
                {
                    model: Order,
                    attributes: [], // We don't need order details, just the filter
                    where: { userId: userId }
                },
                {
                    model: Product,
                    attributes: ['name'] // We need the product name
                }
            ],
            group: ['productId', 'product.id', 'product.name'], // Group by Product to aggregate sum
            order: [[sequelize.fn('SUM', sequelize.col('quantity')), 'DESC']], // Highest Sum first
        });

        // Format string: "Latte (150 sold)"
        let topSellingText = "N/A";
        if (topSellingVariant && topSellingVariant.product) {
            const qty = topSellingVariant.getDataValue('totalSold');
            topSellingText = `${topSellingVariant.product.name} (${qty} sold)`;
        }

        // 4. Send Response
        res.status(200).json({
            totalRevenue: totalRevenue.toFixed(2), // Send as string or float depending on UI needs
            totalOrders: totalOrders,
            totalProfit: totalProfit.toFixed(2),
            averageOrderValue: totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : "0.00",

            // ✅ NEW FIELDS
            lowStockItem: lowStockText,
            topSellingItem: topSellingText
        });

    } catch (error) {
        console.log("Dashboard Stats Error:", error);
        res.status(500).json({ error: error.message });
    }
}