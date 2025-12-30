const jwt = require("jsonwebtoken")

module.exports = async (req, res, next) => {
    const auth_header = req.get("Authorization")
    if (!auth_header) {
        return res.status(401).json({ message: "Not authenticated" })
    }
    let decodeToken
    const token = auth_header.split(" ")[1]
    try {
        decodeToken = jwt.verify(token, process.env.JWT_SECRET)
    } catch (error) {
        return res.status(401).json({ message: "Token Verification failed" })
    }
    if (!decodeToken) {
        return res.status(401).json({ message: "Not Authenticated" })
    }
    req.userId = decodeToken.userId
    req.email = decodeToken.email; // <--- Add this line
    next();
}