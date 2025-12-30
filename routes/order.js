const express = require('express');
const router = express.Router();
const guard = require("../middleware/is-auth")

const orderController = require('../controllers/order');

// POST /orders
router.post('/orders', guard, orderController.create);
//GET /orders
router.get('/orders', guard, orderController.getOrders)
//patch /orders
router.patch('/orders/:id', guard, orderController.updateStatus)

module.exports = router;