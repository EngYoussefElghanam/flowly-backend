const Product = require("../models/products")
const User = require("../models/user")
const OrderItem = require('../models/order_items')
const createProduct = async (req, res, next) => {
    try {
        const name = req.body.name
        const costPrice = req.body.costPrice
        const sellPrice = req.body.sellPrice
        const stock = req.body.stockQuantity
        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" })
        }
        const targetId = user.ownerId
        const result = await Product.create({
            name: name,
            costPrice: costPrice,
            sellPrice: sellPrice,
            userId: targetId,
            stockQuantity: stock,
        })
        res.status(201).json({
            message: 'Product Created Successfully!',
            product: result
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: 'Creating product failed.',
            error: error
        });
    }
}
const getProducts = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" })
        }
        const targetId = user.ownerId
        const products = await Product.findAll({ where: { userId: targetId } })
        res.status(200).json({ data: products })
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: `Server Error fetching data ${error}` })
    }
}

const updateProduct = async (req, res, next) => {
    try {
        const productId = req.params.id
        const name = req.body.name
        const costPrice = req.body.costPrice
        const sellPrice = req.body.sellPrice
        const stock = req.body.stockQuantity
        const product = await Product.findOne({ where: { id: productId, userId: req.userId } })
        if (!product) {
            return res.status(404).json({ message: "Product not found or unauthorized" });
        }
        product.name = name
        product.costPrice = costPrice
        product.sellPrice = sellPrice
        product.stockQuantity = stock
        await product.save()
        res.status(200).json({ message: "Product updated successfully", product });
    } catch (err) {
        console.log("Update Error:", err);
        res.status(500).json({ message: "Failed to update product" });
    }
}

const deleteProduct = async (req, res, next) => {
    const productId = req.params.id;

    try {
        const product = await Product.findOne({
            where: { id: productId, userId: req.userId }
        });

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // 1. Check if this product is part of any past order
        const salesCount = await OrderItem.count({
            where: { productId: productId }
        });

        if (salesCount > 0) {
            // 🛡️ SCENARIO A: It was sold before. 
            // We MUST Archive it to keep order history intact.
            product.isArchived = true;
            await product.save();
            return res.status(200).json({
                message: "Product archived (Item has sales history)"
            });
        } else {
            // 🗑️ SCENARIO B: It was never sold (e.g., a mistake).
            // We can safely Hard Delete it to save space.
            await product.destroy();
            return res.status(200).json({
                message: "Product permanently deleted"
            });
        }

    } catch (err) {
        console.log("Delete Error:", err);
        res.status(500).json({ message: "Failed to delete product" });
    }
};

module.exports = { create: createProduct, get: getProducts, update: updateProduct, delete: deleteProduct }