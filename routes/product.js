const express = require("express")
const router = express.Router()
const guard = require("../middleware/is-auth")

const productController = require("../controllers/product")

router.post('/products', guard, productController.create)
router.get('/products', guard, productController.get)

module.exports = router