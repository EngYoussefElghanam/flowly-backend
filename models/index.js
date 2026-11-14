const User = require('./user');
const Product = require('./products');
const Customer = require('./customer');
const Order = require('./orders');
const OrderItem = require('./order_items');
const marketingOpportunities = require('./marketingOpportunity');

// --- RELATIONSHIP 1: User owns everything
User.hasMany(Product, { constraints: true, onDelete: 'CASCADE' });
Product.belongsTo(User);

User.hasMany(Customer, { constraints: true, onDelete: 'CASCADE' });
Customer.belongsTo(User);

User.hasMany(Order, { constraints: true, onDelete: 'CASCADE' });
Order.belongsTo(User);

// --- RELATIONSHIP 2: Customer & Order
Customer.hasMany(Order, { constraints: true, onDelete: 'SET NULL' });
Order.belongsTo(Customer);

// --- RELATIONSHIP 3: Order & Product (Many-to-Many)
Order.belongsToMany(Product, { through: OrderItem });
Product.belongsToMany(Order, { through: OrderItem });

Order.hasMany(OrderItem, { onDelete: 'CASCADE', hooks: true });
OrderItem.belongsTo(Order);
OrderItem.belongsTo(Product);
Product.hasMany(OrderItem);
Customer.hasMany(marketingOpportunities);
marketingOpportunities.belongsTo(Customer);
User.hasMany(marketingOpportunities);
marketingOpportunities.belongsTo(User);
