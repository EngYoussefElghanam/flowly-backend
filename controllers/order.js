const Order = require("../models/orders");
const Product = require("../models/products");
const OrderItem = require("../models/order_items");
const Customer = require("../models/customer");
const db = require("../util/db")
const User = require("../models/user");
const sequelize = require("sequelize");

// --- HELPER FUNCTION: Get the correct Company/Owner ID ---
const getCompanyId = (user) => {
    if (user.role === 'OWNER') {
        return user.id; // Owners ARE the company
    } else {
        return user.ownerId; // Employees work FOR the company
    }
};

const createOrder = async (req, res, next) => {
    // 1. Start the Transaction Bucket 🛒
    const t = await db.transaction();

    try {
        const customerId = req.body.customerId;
        const productsFromApp = req.body.products;
        productsFromApp.sort((a, b) => a.id - b.id)
        const customer = await Customer.findByPk(customerId);
        // 2. 🔍 FIND THE BOSS
        const user = await User.findByPk(req.userId);
        if (!user) {
            await t.rollback();
            return res.status(404).json({ message: "User not found" });
        }

        // ✅ FIX: Determine Company ID dynamically
        const companyId = getCompanyId(user);

        if (!companyId) {
            await t.rollback();
            return res.status(400).json({ message: "Configuration Error: User has no valid Company ID." });
        }

        if (customer.userId != companyId) {
            await t.rollback();
            return res.status(403).json({ message: "Authorization error this customer doesn't belong to the owner" })
        }

        let total_amount = 0;
        let total_cost = 0;
        const orderItemsData = [];

        // 3. Process Items & Deduct Stock
        for (const item of productsFromApp) {
            // Include transaction here
            const product = await Product.findByPk(item.id, { transaction: t, lock: true });
            if (!product) {
                await t.rollback();
                return res.status(404).json({ message: `Product ID ${item.id} not found` });
            }

            // ✅ FIX: Ensure product belongs to THIS company
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
            userId: companyId, // ✅ Saving under the correct Owner ID
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
                const topProduct = await OrderItem.findAll({
                    attributes: [
                        'productId',
                        [sequelize.fn('SUM', sequelize.col('quantity')), 'totalQty']
                    ],
                    include: [{
                        model: Order,
                        where: { customerId: customerId },
                        attributes: []
                    }],
                    group: ['productId', 'orderItem.productId'],
                    order: [[sequelize.literal('"totalQty"'), 'DESC']],
                    limit: 1,
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
        await t.rollback();
        console.log(error);
        res.status(500).json({ message: 'Creating order failed.', error: error });
    }
};

const getOrders = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.userId);

        //FIX: Use helper to get correct ID
        const targetId = getCompanyId(user);

        const orders = await Order.findAll({
            where: { userId: targetId },
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

        // ✅ FIX: Use helper
        const targetId = getCompanyId(user);

        const order = await Order.findOne({
            where: { id: orderId, userId: targetId },
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
    // 1. Start the Transaction Bucket 🛒
    const t = await db.transaction();

    try {
        const orderId = req.params.id;
        const newStatus = req.body.status;
        const user = await User.findByPk(req.userId);

        // Use helper to get correct Company ID
        const targetId = getCompanyId(user);

        // 2. Find Order & LOCK it 🔒
        // We use lock: true so no one else can edit this order while we are calculating
        const order = await Order.findOne({
            where: { id: orderId, userId: targetId },
            transaction: t,
            lock: true
        });

        if (!order) {
            await t.rollback();
            return res.status(404).json({ message: "Order Not Found" });
        }

        const oldStatus = order.status;

        // DEFINITIONS:
        // "Dead" Status = The items are effectively back in the shop.
        // "Alive" Status = The items are gone/sold.
        const isNowDead = (newStatus === 'RETURNED' || newStatus === 'CANCELLED');
        const wasDead = (oldStatus === 'RETURNED' || oldStatus === 'CANCELLED');

        // 3. LOGIC BRANCHING 🌳

        // SCENARIO A: The order is being CANCELLED (Alive -> Dead) 
        // Action: RESTOCK (+ Increase)
        if (isNowDead && !wasDead) {
            const orderItems = await OrderItem.findAll({ where: { orderId: order.id }, transaction: t });

            for (const item of orderItems) {
                const product = await Product.findByPk(item.productId, { transaction: t, lock: true });

                if (product) {
                    product.stockQuantity += item.quantity; // Put back
                    await product.save({ transaction: t });
                    console.log(`🔄 Restocked Product ${product.name}: +${item.quantity}`);
                }
            }
        }

        // SCENARIO B: The order is being REACTIVATED (Dead -> Alive)
        // Action: DESTOCK (- Decrease)
        else if (!isNowDead && wasDead) {
            const orderItems = await OrderItem.findAll({ where: { orderId: order.id }, transaction: t });

            for (const item of orderItems) {
                const product = await Product.findByPk(item.productId, { transaction: t, lock: true });

                if (product) {
                    // ⚠️ SAFETY CHECK: Do we actually have enough to re-sell?
                    if (product.stockQuantity < item.quantity) {
                        await t.rollback();
                        return res.status(400).json({
                            message: `Cannot re-activate order! Not enough stock for ${product.name}.`
                        });
                    }

                    product.stockQuantity -= item.quantity; // Take out again
                    await product.save({ transaction: t });
                    console.log(`📉 Re-sold Product ${product.name}: -${item.quantity}`);
                }
            }
        }

        // 4. Update the actual status
        order.status = newStatus;
        if (req.body.trackingNumber) {
            order.trackingNumber = req.body.trackingNumber;
        }

        await order.save({ transaction: t });

        // 5. Commit everything 💾
        await t.commit();
        res.status(200).json({ message: "Order updated successfully" });

    } catch (error) {
        // Safety rollback
        try { await t.rollback(); } catch (e) { }
        console.error("Update Status Error:", error);
        res.status(500).json({ message: "Server failure updating status" });
    }
}

module.exports = { create: createOrder, getOrders, updateStatus, getOrderDetails };