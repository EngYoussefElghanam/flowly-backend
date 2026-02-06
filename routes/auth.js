const authController = require("../controllers/auth")
const express = require("express")
const router = express.Router()
const isAuth = require('../middleware/is-auth')

router.post('/signup/initiate', authController.initiateSignup)
router.post('/signup/invite', isAuth, authController.inviteStaff)
router.post('/signup/verify', authController.verifySignup)
router.post('/login', authController.login)
// GET employees (Protected by isAuth)
router.get('/users/employees', isAuth, authController.getEmployees);

// DELETE user (Protected by isAuth)
router.delete('/users/:id', isAuth, authController.deleteUser);

module.exports = router