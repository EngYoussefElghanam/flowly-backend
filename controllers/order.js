const Order = require("../models/orders");
const Product = require("../models/products");
const OrderItem = require("../models/order_items");
const Customer = require("../models/customer");
const db = require("../util/db")
const User = require("../models/user");
const { Model } = require("sequelize");

const createOrder = async (req, res, next) => {
    const t = await db.transaction()//starting our transaction bucket
    try {
        const customerId = req.body.customerId;
        const productsFromApp = req.body.products;

        // 2. 🔍 FIND THE BOSS
        const user = await User.findByPk(req.userId);
        if (!user) {
            await t.rollback() //return everything
            return res.status(404).json({ message: "User not found" });
        }
        const companyId = user.ownerId; // All orders go to this ID

        let total_amount = 0;
        let total_cost = 0;
        const orderItemsData = [];

        // 3. Process Items & Deduct Stock
        for (const item of productsFromApp) {
            const product = await Product.findByPk(item.id, { transaction: t });//add the product to the bucket
            if (!product) {
                await t.rollback()//return all if fails
                return res.status(404).json({ message: `Product ID ${item.id} not found` });
            }

            // Security Check: Ensure product belongs to this company
            if (product.userId !== companyId) {
                await t.rollback()//return if it trying to sell from another company
                return res.status(403).json({ message: "You cannot sell products from another company!" });
            }

            // Stock Check
            if (product.stockQuantity < item.quantity) {
                await t.rollback()//return all if one product fails
                return res.status(400).json({
                    message: `Not enough stock for ${product.name}. Available: ${product.stockQuantity}`
                });
            }

            // Deduct & Save
            product.stockQuantity -= item.quantity;
            await product.save({ transaction: t });//save it and tell the bucket

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

        // 4. Create Order linked to COMPANY (Owner), not just the Employee
        const order = await Order.create({
            totalAmount: total_amount,
            status: 'NEW',
            totalProfit: total_profit,
            courierName: req.body.courierName || '',
            notes: req.body.notes || '',
            customerId: customerId,
            userId: companyId, // <--- THE FIX
        }, { transaction: t });//give what in the bucket

        for (const itemData of orderItemsData) {
            await OrderItem.create({
                quantity: itemData.quantity,
                priceAtPurchase: itemData.priceAtPurchase,
                costAtPurchase: itemData.costAtPurchase,
                orderId: order.id,
                productId: itemData.productId
            }, { transaction: t });//
        }
        await t.commit()
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
}

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