const Order = require("../models/orders");
const Product = require("../models/products");
const OrderItem = require("../models/order_items");
const Customer = require("../models/customer");
const db = require("../util/db")
const User = require("../models/user");
const sequelize = require("sequelize");

const createOrder = async (req, res, next) => {
    // 1. Start the Transaction Bucket 🛒
    const t = await db.transaction();

    try {
        const customerId = req.body.customerId;
        const productsFromApp = req.body.products;

        // 2. 🔍 FIND THE BOSS
        const user = await User.findByPk(req.userId);
        if (!user) {
            await t.rollback();
            return res.status(404).json({ message: "User not found" });
        }
        const companyId = user.ownerId;

        let total_amount = 0;
        let total_cost = 0;
        const orderItemsData = [];

        // 3. Process Items & Deduct Stock
        for (const item of productsFromApp) {
            // Include transaction here
            const product = await Product.findByPk(item.id, { transaction: t });

            if (!product) {
                await t.rollback();
                return res.status(404).json({ message: `Product ID ${item.id} not found` });
            }

            if (product.userId !== companyId) {
                await t.rollback();
                return res.status(403).json({ message: "You cannot sell products from another company!" });
            }

            if (product.stockQuantity < item.quantity) {
                await t.rollback();
                return res.status(400).json({
                    message: `Not enough stock for ${product.name}. Available: ${product.stockQuantity}`
                });
            }

            // Update Stock
            product.stockQuantity -= item.quantity;
            await product.save({ transaction: t });

            const current_price = product.sellPrice;
            const current_cost = product.costPrice;

            total_amount += current_price * item.quantity;
            total_cost += current_cost * item.quantity;

            orderItemsData.push({
                productId: product.id,
                quantity: item.quantity,
                priceAtPurchase: current_price,
                costAtPurchase: current_cost
            });
        }

        const total_profit = total_amount - total_cost;

        // 4. Create Order
        const order = await Order.create({
            totalAmount: total_amount,
            status: 'NEW',
            totalProfit: total_profit,
            courierName: req.body.courierName || '',
            notes: req.body.notes || '',
            customerId: customerId,
            userId: companyId,
        }, { transaction: t });

        // 6. Create Order Items
        for (const itemData of orderItemsData) {
            await OrderItem.create({
                quantity: itemData.quantity,
                priceAtPurchase: itemData.priceAtPurchase,
                costAtPurchase: itemData.costAtPurchase,
                orderId: order.id,
                productId: itemData.productId
            }, { transaction: t });
        }
        if (customerId) {
            const customer = await Customer.findByPk(customerId, { transaction: t });
            if (customer) {
                // A. Update Basic Metrics
                customer.lastOrderDate = new Date();
                customer.totalOrders += 1;
                customer.totalSpent += total_amount;

                // B. 🧠 Calculate Favorite Item (The "Winner" Query)
                // We ask the DB: "Sum up quantities for this user, group by product, give me #1"
                // This counts the items we JUST added because we are inside transaction 't'
                const topProduct = await OrderItem.findAll({
                    attributes: [
                        'productId',
                        [sequelize.fn('SUM', sequelize.col('quantity')), 'totalQty']
                    ],
                    include: [{
                        model: Order,
                        where: { customerId: customerId }, // Filter by this customer
                        attributes: [] // Don't fetch order data, just use for filtering
                    }],
                    group: ['productId', 'orderItem.productId'], // Grouping rules
                    order: [[sequelize.literal('"totalQty"'), 'DESC']], // Highest Quantity on top
                    limit: 1, // Only need the winner
                    transaction: t
                });

                // C. If we found a winner, get its name and update
                if (topProduct.length > 0) {
                    const winnerId = topProduct[0].productId;
                    const productDetails = await Product.findByPk(winnerId, { transaction: t });

                    if (productDetails) {
                        customer.favoriteItem = productDetails.name;
                    }
                }

                // D. Save EVERYTHING (Stats + Favorite) in one DB write 💾
                await customer.save({ transaction: t });
            }
        }

        // 7. Commit everything if we got here safely
        await t.commit();

        res.status(201).json({
            message: 'Order Created Successfully!',
            orderId: order.id,
            totalAmount: total_amount,
            profit: total_profit
        });

    } catch (error) {
        // If ANYTHING above fails, undo it all
        await t.rollback();
        console.log(error);
        res.status(500).json({ message: 'Creating order failed.', error: error });
    }
};

const getOrders = async (req, res, next) => {
    try {
        // 1. Fetch based on Owner ID
        const user = await User.findByPk(req.userId);

        const orders = await Order.findAll({
            where: { userId: user.ownerId }, // <--- THE FIX
            include: [Customer, Product],
            order: [['createdAt', 'DESC']]
        })

        res.status(200).json({ data: orders })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: "failed to fetch order", error: err })
    }
}

const getOrderDetails = async (req, res, next) => {
    const orderId = req.params.id
    try {
        const user = await User.findByPk(req.userId);
        const order = await Order.findOne({
            where: { id: orderId, userId: user.ownerId },
            include: [{ model: Product }]
        })
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.status(200).json(order)
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: `Server Error : ${error}` })
    }
}

const updateStatus = async (req, res, next) => {
    try {
        const orderId = req.params.id
        const status = req.body.status

        const user = await User.findByPk(req.userId);

        // 2. Check using Owner ID
        const order = await Order.findOne({
            where: { id: orderId, userId: user.ownerId } // <--- THE FIX
        })

        if (!order) {
            return res.status(404).json({ message: "Order Not Found" })
        }

        order.status = status;
        if (req.body.trackingNumber) {
            order.trackingNumber = req.body.trackingNumber
        }
        await order.save()

        res.status(200).json({ message: "Order updated successfully" })
    } catch (error) {
        res.status(500).json({ message: "Server failure updating status" })
    }
}

module.exports = { create: createOrder, getOrders, updateStatus, getOrderDetails };