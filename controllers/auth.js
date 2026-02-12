const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const User = require("../models/user")
const PendingUser = require('../models/pending_user')
const emailer = require('../util/email')
const Product = require('../models/products')
const Order = require('../models/orders')
const Customer = require('../models/customer')
const sequelize = require('../util/db')
const MarketingOpportunity = require('../models/marketingOpportunity')
const dns = require('dns').promises

const isValidEmailDomain = async (email) => {
    try {
        const domain = email.split('@')[1];
        if (!domain) return false;

        // Ask DNS: "Give me the Mail Exchange (MX) records for this domain"
        const addresses = await dns.resolveMx(domain);

        // If we get an array and it has at least one server, it's valid!
        return addresses && addresses.length > 0;
    } catch (error) {
        // If domain doesn't exist or has no mail servers, this error triggers
        return false;
    }
};

exports.getEmployees = async (req, res, next) => {
    const userId = req.userId
    try {
        const employees = await User.findAll({ where: { ownerId: userId } });
        res.status(200).json({ employees: employees });
    } catch (err) {
        if (!err.statusCode) err.statusCode = 500;
        next(err);
    }
}

exports.deleteUser = async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
        const intendedId = Number(req.params.id);
        if (!Number.isInteger(intendedId)) {
            await t.rollback();
            return res.status(400).json({ message: "Invalid user id" });
        }

        const reqUser = await User.findByPk(req.userId, { transaction: t });
        if (!reqUser) {
            await t.rollback();
            return res.status(401).json({ message: "Authentication failed" });
        }

        const targetUser = await User.findByPk(intendedId, { transaction: t });
        if (!targetUser) {
            await t.rollback();
            return res.status(404).json({ message: "User not found" });
        }

        // ---- Authorization ----
        const isSelfDelete = targetUser.id === reqUser.id;

        const isOwnerDeletingEmployee =
            reqUser.role === "OWNER" &&
            targetUser.role === "EMPLOYEE" &&
            targetUser.ownerId === reqUser.id;

        const isOwnerDeletingSelf =
            reqUser.role === "OWNER" &&
            isSelfDelete &&
            reqUser.ownerId === null;

        if (!(isOwnerDeletingEmployee || isOwnerDeletingSelf)) {
            await t.rollback();
            return res.status(403).json({ message: "Forbidden: You cannot perform this action." });
        }

        // ---- Deletion & Cleanup ----
        if (targetUser.role === "OWNER") {
            console.log(`⚠️ Deleting Business Data for Owner ${targetUser.id}...`);

            // 1. Delete Staff
            await User.destroy({ where: { ownerId: targetUser.id }, transaction: t });

            // 2. Delete Inventory
            await Product.destroy({ where: { userId: targetUser.id }, transaction: t });

            // 3. Delete Customers
            await Customer.destroy({ where: { userId: targetUser.id }, transaction: t });

            // 4. Delete Orders (If your DB cascades OrderItems, this is enough)
            await Order.destroy({ where: { userId: targetUser.id }, transaction: t });

            // 5. Delete Marketing AI Data
            // If you forget this, the delete will FAIL because these rows point to the user
            await MarketingOpportunity.destroy({ where: { userId: targetUser.id }, transaction: t });
        }

        // Finally, delete the target (Owner or Employee)
        await targetUser.destroy({ transaction: t });

        await t.commit();
        return res.status(200).json({ message: "User and associated data deleted successfully" });

    } catch (err) {
        // Safety rollback in case transaction is still active
        try { await t.rollback(); } catch (_) { }

        console.error("Delete User Error:", err);
        if (!err.statusCode) err.statusCode = 500;
        next(err);
    }
};
// PUBLIC SIGNUP: Strictly for New Owners
exports.initiateSignup = async (req, res, next) => {
    try {
        const name = req.body.name;
        const email = req.body.email;
        const phone = req.body.phone;
        const password = req.body.password;

        // 🔒 SECURITY FIX: Ignore user input for role/ownerId.
        // Public signups are ALWAYS Owners of a new business.
        const role = 'OWNER';
        const ownerId = null;

        // A. Basic Regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(422).json({ message: "Invalid email format." });
        }

        // B. DNS Check
        const isDomainReal = await isValidEmailDomain(email);
        if (!isDomainReal) {
            return res.status(422).json({ message: "Invalid email domain." });
        }

        const existingUser = await User.findOne({ where: { email: email } });
        if (existingUser) {
            return res.status(409).json({ message: "User already exists." });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedCode = await bcrypt.hash(code, 12);
        const hashedPassword = await bcrypt.hash(password, 12);

        // Clear old pending requests for this email
        await PendingUser.destroy({ where: { email: email } });

        await PendingUser.create({
            name,
            email,
            password: hashedPassword,
            phone: (phone && phone.trim().length > 0) ? phone : null,
            role: role,     //  Hardcoded to OWNER
            ownerId: ownerId, //  Hardcoded to NULL
            verificationCode: hashedCode,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000)
        });

        await emailer.sendVerificationEmail(email, code);

        res.status(200).json({ message: "Verification code sent to email." });

    } catch (err) {
        if (!err.statusCode) err.statusCode = 500;
        next(err);
    }
};

// PROTECTED STAFF INVITE: Only for Logged-in Owners
// Add this route to routes/auth.js protected by isAuth middleware!
exports.inviteStaff = async (req, res, next) => {
    try {
        // We get the data from the Owner who is adding the staff
        const name = req.body.name;
        const email = req.body.email;
        const phone = req.body.phone;
        const password = req.body.password; // Owner sets the initial password

        // SECURITY FIX:
        // We do NOT trust the body for ownerId. We take it from the Token.
        const requesterId = req.userId;
        const requester = await User.findByPk(requesterId);
        if (!requester || requester.role !== 'OWNER') {
            return res.status(403).json({ message: "Only Owners can invite staff." });
        }

        const role = 'EMPLOYEE';
        const ownerId = requester.id; // Linked securely to the authenticated Owner

        // ... (Same Validation Logic as above) ...
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(422).json({ message: "Invalid email format." });
        }

        const existingUser = await User.findOne({ where: { email: email } });
        if (existingUser) {
            return res.status(409).json({ message: "User already exists." });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedCode = await bcrypt.hash(code, 12);
        const hashedPassword = await bcrypt.hash(password, 12);

        await PendingUser.destroy({ where: { email: email } });

        await PendingUser.create({
            name,
            email,
            password: hashedPassword,
            phone: (phone && phone.trim().length > 0) ? phone : null,
            role: role,       //  Hardcoded to EMPLOYEE
            ownerId: ownerId, //  Hardcoded to Req User ID
            verificationCode: hashedCode,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000)
        });

        await emailer.sendVerificationEmail(email, code);

        res.status(200).json({ message: "Staff verification code sent." });

    } catch (err) {
        if (!err.statusCode) err.statusCode = 500;
        next(err);
    }
};

exports.verifySignup = async (req, res, next) => {
    try {
        const email = req.body.email
        const code = req.body.code

        // A. Find Pending Record
        const pendingUser = await PendingUser.findOne({ where: { email: email } });

        if (!pendingUser) {
            return res.status(404).json({ message: "Request expired or email not found." });
        }

        // B. Check Expiration
        if (new Date() > pendingUser.expiresAt) {
            await pendingUser.destroy(); // Cleanup
            return res.status(401).json({ message: "Code expired. Please signup again." });
        }

        // C. Check Code
        const isEqual = await bcrypt.compare(code, pendingUser.verificationCode);
        if (!isEqual) {
            return res.status(401).json({ message: "Invalid verification code." });
        }

        // D. MOVE TO REAL TABLE (The "Commit")
        const newUser = await User.create({
            name: pendingUser.name,
            email: pendingUser.email,
            password: pendingUser.password, // Already hashed
            phone: pendingUser.phone,
            role: pendingUser.role,
            ownerId: pendingUser.ownerId
        });

        // E. Cleanup Pending
        await pendingUser.destroy();

        // F. Generate Token (Auto Login)
        const token = jwt.sign(
            { email: newUser.email, userId: newUser.id },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.status(201).json({
            token: token,
            userId: newUser.id.toString(),
            name: newUser.name,
            email: newUser.email,
            role: newUser.role
        });

    } catch (err) {
        if (!err.statusCode) err.statusCode = 500;
        next(err);
    }
};

exports.login = async (req, res, next) => {
    try {
        const email = req.body.email;
        const password = req.body.password;

        // 1. Try to find the user
        const user = await User.findOne({ where: { email: email } });

        // 2. SAFETY CHECK: If user is null, STOP here.
        // We return the generic message so hackers don't know the email is wrong.
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // 3. Now it is safe to check the password (user is definitely not null)
        const rightPass = await bcrypt.compare(password, user.password);

        // 4. Password Check
        if (!rightPass) {
            // We return the EXACT SAME message. Confusing the hacker! 🕵️‍♂️
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // 5. Success! Generate Token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        res.status(200).json({
            token: token,
            userId: user.id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            ownerId: user.ownerId
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error });
    }
};