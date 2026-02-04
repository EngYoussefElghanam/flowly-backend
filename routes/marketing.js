const express = require('express');
const marketingController = require('../controllers/marketing');
const isAuth = require('../middleware/is-auth'); // 🔒 Protect these routes!

const router = express.Router();
router.get('/opportunities', isAuth, marketingController.getOpportunities);
router.post('/action/:id', isAuth, marketingController.handleAction);

module.exports = router;