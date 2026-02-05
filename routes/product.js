const express = require("express")
const router = express.Router()
const guard = require("../middleware/is-auth")

const productController = require("../controllers/product")

router.post('/products', guard, productController.create)
router.get('/products', guard, productController.get)
router.put('/products/:id', guard, productController.update)
router.delete('/products/:id', guard, productController.delete)

module.exports = router