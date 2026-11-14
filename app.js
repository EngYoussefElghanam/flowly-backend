require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// Database and route registration.
const sequelize = require('./util/db');

const productRoute = require('./routes/product');
const orderRoutes = require('./routes/order');
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customer');
const dashboardRoutes = require('./routes/dashboard');
const marketingRoutes = require('./routes/marketing');
const settingsRoutes = require('./routes/settings');

require('./models');

const app = express();

// Middleware (To handle JSON data and allow Mobile App access)
app.use(bodyParser.json());
app.use(cors());
app.use('/api', productRoute);
app.use('/api', orderRoutes);
app.use('/api', authRoutes);
app.use('/api', customerRoutes);
app.use('/api', dashboardRoutes);
app.use('/marketing', marketingRoutes);
app.use('/api', settingsRoutes);
// Test Route
app.get('/', (req, res) => {
  res.json({ message: 'Seller App Backend is Running!' });
});

// Importing the app for tests must not connect to the database or bind a port.
if (require.main === module) {
  sequelize
    .authenticate()
    .then(() => {
      console.log('✅ Database connection established');
      return sequelize.sync();
    })
    .then(() => {
      console.log('✅ Tables synced!');
      const PORT = process.env.PORT || 3000;

      app.listen(PORT, '0.0.0.0', () => {
        console.log('🚀 Server is running on port ' + PORT);
      });
    })
    .catch((err) => {
      console.log('❌ Database Error:', err);
      process.exit(1);
    });
}

module.exports = app;
