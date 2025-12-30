const express = require("express")
const router = express.Router()
const guard = require("../middleware/is-auth")
const customerController = require("../controllers/customer")
router.use(guard)
router.get('/customers', customerController.getCustomers)
router.post('/customers', customerController.createCustomer)
router.get('/customers/:id', customerController.getCustomerDetails)

module.exports = router