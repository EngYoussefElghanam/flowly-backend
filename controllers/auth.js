const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const User = require("../models/user")

exports.signup = async (req, res, next) => {
    try {
        const name = req.body.name
        const email = req.body.email
        const password = req.body.password
        const phone = req.body.phone

        // 1. Determine Role
        let role = "EMPLOYEE"
        if (req.body.role) {
            role = req.body.role
        }

        // 2. 🛡️ GUARD: Validate Employee HAS an Owner
        // We do this BEFORE hashing passwords or talking to DB
        if (role === 'EMPLOYEE' && !req.body.ownerId) {
            return res.status(400).json({
                message: "Cannot create Employee without an Owner ID."
            });
        }

        // 3. Check if User Exists
        const userExist = await User.findOne({ where: { email: email } })
        if (userExist) {
            return res.status(409).json({ message: "Email already exists" })
        }

        const hashedPassword = await bcrypt.hash(password, 12)

        // 4. Create the User
        // If it's an employee, we insert ownerId RIGHT NOW.
        let user = await User.create({
            name: name,
            email: email,
            password: hashedPassword,
            phone: phone,
            role: role,
            // If employee, use the ID from body. If owner, this is undefined (null) for now.
            ownerId: role === 'EMPLOYEE' ? req.body.ownerId : null
        })

        // 5. Handle Owner Self-Reference
        // Only if it's an OWNER, we update the ownerId to match their new ID
        if (role === 'OWNER') {
            user.ownerId = user.id;
            await user.save();
        }

        res.status(201).json({
            message: "User Created Successfully",
            userId: user.id
        })

    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message: `Server side failure ${error}`
        })
    }
}

exports.login = async (req, res, next) => {
    try {
        const email = req.body.email
        const password = req.body.password
        const user = await User.findOne({ where: { email: email } })
        const rightPass = await bcrypt.compare(password, user.password)
        // Safer approach
        if (!user || !rightPass) { // Check both, or check sequentially but return same error
            // Don't tell them which one failed!
            return res.status(401).json({ message: "Invalid email or password" });
        }
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,//in production should go to env
            { expiresIn: "30d" }
        )
        res.status(200).json({
            token: token,
            userId: user.id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            ownerId: user.ownerId
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error });
    }
}