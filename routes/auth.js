const authController = require("../controllers/auth")
const express = require("express")
const router = express.Router()

router.post('/signup/initiate', authController.initiateSignup)
router.post('/signup/verify', authController.verifySignup)
router.post('/login', authController.login)

module.exports = router