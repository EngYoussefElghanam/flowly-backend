require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// 1. Import the Database Connection
const sequelize = require('./util/db');

//Import routes
const productRoute = require("./routes/product")
const orderRoutes = require('./routes/order');
const authRoutes = require("./routes/auth")
const customerRoutes = require("./routes/customer")
const dashboardRoutes = require("./routes/dashboard")

// 2. Import All Your Models
const User = require('./models/user');
const Product = require('./models/products');
const Customer = require('./models/customer');
const Order = require('./models/orders');
const OrderItem = require('./models/order_items');

const app = express();

// Middleware (To handle JSON data and allow Mobile App access)
app.use(bodyParser.json());
app.use(cors());
app.use('/api', productRoute);
app.use('/api', orderRoutes);
app.use('/api', authRoutes)
app.use('/api', customerRoutes)
app.use('/api', dashboardRoutes)
// Test Route
app.get('/', (req, res) => {
    res.json({ message: 'Seller App Backend is Running!' });
});

// --- RELATIONSHIP 1: User owns everything
User.hasMany(Product, { constraints: true, onDelete: 'CASCADE' });
Product.belongsTo(User);

User.hasMany(Customer, { constraints: true, onDelete: 'CASCADE' });
Customer.belongsTo(User);

User.hasMany(Order, { constraints: true, onDelete: 'CASCADE' });
Order.belongsTo(User);


// --- RELATIONSHIP 2: Customer & Order
Customer.hasMany(Order, { constraints: true, onDelete: 'SET NULL' })
Order.belongsTo(Customer)


// --- RELATIONSHIP 3: Order & Product (Many-to-Many)
Order.belongsToMany(Product, { through: OrderItem })
Product.belongsToMany(Order, { through: OrderItem })



// 3. SYNC DATABASE & START SERVER
// Note: Use { force: true } inside sync() ONLY if you need to reset the DB completely.
sequelize
    .sync()
    .then(result => {
        console.log("✅ Database Connected & Tables Linked!");
        app.listen(3000, '0.0.0.0', () => {
            console.log("🚀 Server is running on port 3000");
        });
    })
    .catch(err => {
        console.log("❌ Database Error:", err);
    });