const express = require('express')
const router = express.Router()
const guard = require('../middleware/is-auth')
const settingsController = require('../controllers/settings')

router.get('/settings', guard, settingsController.getSettings)
router.put('/settings', guard, settingsController.updateSettings)

module.exports = router