const express = require("express")
const router = express.Router()
const guard = require("../middleware/is-auth")
const controller = require("../controllers/dashboard")
router.get("/dashboard", guard, controller.getDashboardStats)
module.exports = router