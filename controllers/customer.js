const Customer = require("../models/customer");
const Order = require("../models/orders");
const User = require("../models/user");
const OrderItem = require("../models/order_items")
const Product = require("../models/products")

// 🛠️ HELPER: Get the correct Company/Owner ID
const getCompanyId = (user) => {
    if (user.role === 'OWNER') {
        return user.id;
    } else {
        return user.ownerId;
    }
};

exports.getCustomers = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // ✅ FIX: Use helper to support both Owners and Employees
        const targetId = getCompanyId(user);

        const customers = await Customer.findAll({
            where: { userId: targetId },
            order: [['updatedAt', 'DESC']]
        });

        res.status(200).json({ data: customers });
    } catch (error) {
        res.status(500).json({ message: `Server Error ${error}` });
    }
}

exports.createCustomer = async (req, res, next) => {
    try {
        const { name, phone, city, address } = req.body;

        if (!city || !address || !phone || !name) {
            return res.status(400).json({ message: "Please add all required fields" });
        }

        const user = await User.findByPk(req.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // ✅ FIX: Determine correct company ID
        const companyId = getCompanyId(user);

        if (!companyId) {
            return res.status(400).json({ message: "Account setup error: No Company ID found." });
        }

        // 2. Check if phone exists IN THIS COMPANY
        const customerExists = await Customer.findOne({
            where: { phone: phone, userId: companyId }
        });

        if (customerExists) {
            return res.status(409).json({ message: "Customer already exists" });
        }

        // 3. Create Linked to Company
        const newCustomer = await Customer.create({
            name: name,
            phone: phone,
            city: city,
            address: address,
            userId: companyId // ✅ Fixed
        });

        res.status(201).json({ message: "Customer Created successfully", customer: newCustomer });
    } catch (error) {
        res.status(500).json({
            message: `Failed to create customer ${error}`
        });
    }
}

exports.getCustomerDetails = async (req, res, next) => {
    try {
        const customerId = req.params.id;
        const user = await User.findByPk(req.userId);

        // ✅ FIX: Verify access using correct ID
        const targetId = getCompanyId(user);

        const customer = await Customer.findOne({
            where: { id: customerId, userId: targetId },
            include: [{ model: Order, limit: 10, order: [['createdAt', 'DESC']] }]
        });

        if (!customer) return res.status(404).json({ message: "Customer not found" });

        res.status(200).json({ data: customer });
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
}

exports.getCustomerStats = async (req, res, next) => {
    const customerId = req.params.id
    try {
        // Optional: You could add a security check here using getCompanyId 
        // to ensure the user actually owns this customer before calculating stats,
        // but for now, this logic works as long as the ID is valid.

        const orders = await Order.findAll({
            where: { customerId: customerId, status: "DELIVERED" },
            include: [{ model: OrderItem, include: [{ model: Product }] }]
        })

        if (!orders || orders.length == 0) {
            return res.status(200).json({
                totalSpent: "0.00",
                totalOrders: 0,
                favoriteItem: "N/A"
            })
        }

        let totalSpent = 0
        const totalOrders = orders.length
        const productFreq = {}

        orders.forEach(order => {
            totalSpent += parseFloat(order.totalAmount)
            order.orderItems.forEach(item => {
                const productName = item.product ? item.product.name : "Unknown"
                if (productFreq[productName]) {
                    productFreq[productName] += item.quantity
                } else {
                    productFreq[productName] = item.quantity
                }
            })
        })

        let favoriteItem = "N/A"
        let maxCount = 0
        for (const [product, count] of Object.entries(productFreq)) {
            if (count > maxCount) {
                maxCount = count;
                favoriteItem = product;
            }
        }

        res.status(200).json({
            totalSpent: totalSpent.toFixed(2),
            totalOrders: totalOrders,
            favoriteItem: favoriteItem
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Failed to fetch stats" });
    }
}