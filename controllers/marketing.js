const { GoogleGenerativeAI } = require('@google/generative-ai')
const { Op } = require('sequelize')
const marketingOpportunities = require('../models/marketingOpportunity')
const Customer = require('../models/customer')
const User = require('../models/user')

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// 🛠️ HELPER: Get the correct Company/Owner ID
const getCompanyId = (user) => {
    if (user.role === 'OWNER') {
        return user.id;
    } else {
        return user.ownerId;
    }
};

exports.getOpportunities = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // ✅ FIX 1: Use Company ID (Owner's ID)
        const targetId = getCompanyId(user);

        // We need the owner object specifically to read settings (thresholds)
        // If I am the owner, 'user' is the owner. If I am employee, I need to fetch my boss.
        let ownerSettings = user;
        if (user.role === 'EMPLOYEE') {
            ownerSettings = await User.findByPk(targetId);
        }

        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)

        // 1. Fetch Opportunities for the COMPANY (targetId)
        const existingOpportunities = await marketingOpportunities.findAll({
            where: {
                createdAt: { [Op.gte]: startOfDay },
                userId: targetId // ✅ Use targetId
            },
            include: [{
                model: Customer,
                attributes: ['id', 'name', 'phone', 'totalSpent', 'favoriteItem', 'totalOrders']
            }]
        });

        const wokeOpportunities = await marketingOpportunities.findAll({
            where: {
                status: 'SNOOZED',
                snoozedUntil: { [Op.lte]: new Date() },
                userId: targetId // ✅ Use targetId
            },
            include: {
                model: Customer,
                attributes: ['id', 'name', 'phone', 'totalOrders', 'totalSpent', 'favoriteItem']
            }
        })

        if (existingOpportunities.length > 0 || wokeOpportunities.length > 0) {
            const pendingOnly = existingOpportunities.filter(o => o.status === 'PENDING');

            const rawResponse = [...pendingOnly, ...wokeOpportunities].map(opp => {
                const plainOpp = opp.toJSON();
                if (plainOpp.Customer) {
                    plainOpp.customer = plainOpp.Customer;
                    delete plainOpp.Customer;
                }
                return plainOpp;
            });

            return res.status(200).json({ opportunities: rawResponse })
        }

        //CACHE MISS now generate and call AI
        console.log(`Generating new AI Marketing Opportunities for Company ${targetId}......`)

        // Use settings from the Owner object we fetched earlier
        const inactiveThreshold = ownerSettings.inactiveThreshold || 30
        const vipOrderThreshold = ownerSettings.vipOrderThreshold || 5

        const minimumInactiveDate = new Date()
        minimumInactiveDate.setDate(minimumInactiveDate.getDate() - inactiveThreshold)

        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        const inactiveCustomers = await Customer.findAll({
            where: {
                userId: targetId, // ✅ Use targetId
                lastOrderDate: { [Op.lt]: minimumInactiveDate },
                [Op.or]: [
                    { lastMarketingSentAt: null },
                    { lastMarketingSentAt: { [Op.lt]: sevenDaysAgo } }
                ]
            },
            limit: 5
        })

        const vipCustomers = await Customer.findAll({
            where: {
                userId: targetId, // ✅ Use targetId
                totalOrders: { [Op.gte]: vipOrderThreshold },
                // You usually want VIPs to be active, but removed the strict date check here to catch 'recent' VIPs too.
                // You can add it back if you only want 'current' VIPs.
                [Op.or]: [
                    { lastMarketingSentAt: null },
                    { lastMarketingSentAt: { [Op.lt]: sevenDaysAgo } }
                ]
            },
            limit: 5
        })

        const allCandidates = [
            ...inactiveCustomers.map(c => ({ customer: c, type: 'WIN_BACK' })),
            ...vipCustomers.map(c => ({ customer: c, type: 'VIP_REWARD' }))
        ]

        const newOpportunities = [];

        // Note: Ensure model name is correct. Usually 'gemini-1.5-flash' or 'gemini-pro'.
        // 'gemini-2.5-flash' might not exist yet depending on the SDK version.
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        for (const item of allCandidates) {
            const c = item.customer;
            const productHook = c.favoriteItem ? c.favoriteItem : "your next order";
            const offer = item.type === 'WIN_BACK' ? "20% Off" : "Buy 1 Get 1 Free";

            const prompt = `
                You are an automated marketing assistant for a business (online or physical).
                Write a short, friendly WhatsApp message (max 20 words).
                
                Customer: ${c.name}
                Context: ${item.type === 'WIN_BACK' ? "They haven't ordered in a while." : "They are a loyal VIP."}
                
                Goal: Offer ${offer} on ${productHook}.
                
                IMPORTANT: 
                - Do NOT use the word "visit" or "store" (assume they might be ordering online).
                - Use phrases like "next order" or "grab yours".
                
                Tone: Warm, welcoming, use emojis.
                Output: Just the message text, no quotes.
            `;

            try {
                const result = await model.generateContent(prompt);
                const response = await result.response;
                const text = response.text().trim();

                const opp = await marketingOpportunities.create({
                    customerId: c.id,
                    type: item.type,
                    aiMessage: text,
                    status: 'PENDING',
                    userId: targetId // ✅ Use targetId
                });

                opp.dataValues.customer = c;
                newOpportunities.push(opp);

            } catch (err) {
                console.error("Gemini Error:", err);
            }
        }

        res.status(200).json({ opportunities: newOpportunities });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Failed to fetch opportunities" });
    }
}

// 3. ACTIONS (Send / Dismiss) 👆
exports.handleAction = async (req, res, next) => {
    const oppId = req.params.id;
    const action = req.body.action;

    try {
        // Technically, any employee of the company can act on an opportunity.
        // But we should verify they belong to the same company.

        const user = await User.findByPk(req.userId);
        const targetId = getCompanyId(user);

        const opp = await marketingOpportunities.findOne({
            where: { id: oppId, userId: targetId } // ✅ Security Check
        });

        if (!opp) return res.status(404).json({ message: "Not found or unauthorized" });

        if (action === 'SENT') {
            opp.status = 'SENT';
            const customer = await Customer.findByPk(opp.customerId);
            if (customer) {
                customer.lastMarketingSentAt = new Date();
                await customer.save();
            }

        } else if (action === 'SNOOZED') {
            opp.status = 'SNOOZED';
            const wakeUpDate = new Date();
            wakeUpDate.setDate(wakeUpDate.getDate() + 2);
            opp.snoozedUntil = wakeUpDate; // Check your DB column name (snoozeUntil vs snoozedUntil)

        } else if (action === 'REJECTED') {
            opp.status = 'DISMISSED';
        }

        await opp.save();
        res.status(200).json({ message: "Action recorded" });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Action failed" });
    }
};