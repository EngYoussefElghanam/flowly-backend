const Order = require('../models/orders')
const Product = require('../models/products')
const OrderItem = require('../models/order_items')
const User = require('../models/user') // ✅ Import User model
const sequelize = require('sequelize')

// 🛠️ HELPER: Get the correct Company/Owner ID
const getCompanyId = (user) => {
    if (user.role === 'OWNER') {
        return user.id;
    } else {
        return user.ownerId;
    }
};

exports.getDashboardStats = async (req, res, next) => {
    try {
        // 1. Fetch User & Determine Company ID
        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const targetId = getCompanyId(user); // ✅ Use targetId for all queries below
        const owner = await User.findByPk(targetId)
        // 2. Fetch Orders for the Company
        const orders = await Order.findAll({ where: { userId: targetId } });

        let totalRevenue = 0;
        let totalProfit = 0;
        const totalOrders = orders.length;

        for (const order of orders) {
            totalRevenue += parseFloat(order.totalAmount || 0);
            totalProfit += parseFloat(order.totalProfit || 0);
        }
        // 🔍 DEBUG LOG
        console.log("---------------- SETTINGS DEBUG ----------------");
        console.log("Owner ID:", owner.id);
        console.log("DB Value for Threshold:", owner.lowStockThreshold);
        console.log("Effective Threshold:", owner.lowStockThreshold || 15);
        console.log("------------------------------------------------");
        // 3. Low Stock Logic (Using targetId)
        const lowStockThreshold = owner.lowStockThreshold || 15;

        const lowStockProduct = await Product.findOne({
            where: { userId: targetId }, // ✅ Check Company's inventory
            order: [['stockQuantity', 'ASC']],
            attributes: ['name', 'stockQuantity']
        });

        let lowStockText = "All Stock Good";

        if (lowStockProduct && lowStockProduct.stockQuantity <= lowStockThreshold) {
            lowStockText = `${lowStockProduct.name} (${lowStockProduct.stockQuantity} units)`;
        }

        // 4. Top Selling Item Logic (Using targetId)
        const topSellingVariant = await OrderItem.findOne({
            attributes: [
                [sequelize.fn('SUM', sequelize.col('quantity')), 'totalSold']
            ],
            include: [
                {
                    model: Order,
                    attributes: [],
                    where: { userId: targetId } // ✅ Filter orders by Company
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

        // 5. Send Response
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