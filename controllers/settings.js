const User = require('../models/user')

//GET settings
exports.getSettings = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.userId, { attributes: ['inactiveThreshold', 'vipOrderThreshold'] })
        if (!user) {
            return res.status(404).json({ message: "user not found!" })
        }
        res.status(200).json({ inactiveThreshold: user.inactiveThreshold, vipOrderThreshold: user.vipOrderThreshold });
    } catch (error) {
        console.log(err);
        res.status(500).json({ message: `Failed to fetch settings ${err}` });
    }
}

//PUT settings
exports.updateSettings = async (req, res, next) => {
    try {
        const inactiveThreshold = req.body.inactiveThreshold
        const vipOrderThreshold = req.body.vipOrderThreshold
        const user = await User.findByPk(req.userId)
        if (!user) {
            return res.status(404).json({ message: "User not found" })
        }
        user.inactiveThreshold = inactiveThreshold
        user.vipOrderThreshold = vipOrderThreshold
        await user.save()
        res.status(200).json({ message: "Settings updated successfully" });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Failed to update settings" });
    }
}