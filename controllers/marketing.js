const { GoogleGenerativeAI } = require('@google/generative-ai')
const { Op, Model, where } = require('sequelize')
const marketingOpportunities = require('../models/marketingOpportunity')
const Customer = require('../models/customer')
const User = require('../models/user')

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

exports.getOpportunities = async (req, res, next) => {
    const userId = req.userId
    const owner = await User.findByPk(userId)
    try {
        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)
        const existingOpportunities = await marketingOpportunities.findAll({
            where: {
                createdAt: { [Op.gte]: startOfDay },
                userId: userId
            },
            include: [{
                model: Customer,
                // ✅ ADD 'id' HERE!
                attributes: ['id', 'name', 'phone', 'totalSpent', 'favoriteItem', 'totalOrders']
            }]
        });

        const wokeOpportunities = await marketingOpportunities.findAll({
            where: {
                status: 'SNOOZED',
                snoozedUntil: { [Op.lte]: new Date() },
                userId: userId
            },
            include: {
                model: Customer,
                // ✅ ADD 'id' HERE TOO!
                attributes: ['id', 'name', 'phone', 'totalOrders', 'totalSpent', 'favoriteItem']
            }
        })

        if (existingOpportunities.length > 0 || wokeOpportunities.length > 0) {
            const pendingOnly = existingOpportunities.filter(o => o.status === 'PENDING');

            // 2. FIX: Normalize the Data structure
            // We map over the results to ensure "customer" is always lowercase and structured correctly
            const rawResponse = [...pendingOnly, ...wokeOpportunities].map(opp => {
                const plainOpp = opp.toJSON(); // Convert Sequelize Instance to Plain JSON

                // If Sequelize returned "Customer" (Capital), move it to "customer" (Lower)
                if (plainOpp.Customer) {
                    plainOpp.customer = plainOpp.Customer;
                    delete plainOpp.Customer;
                }

                return plainOpp;
            });

            return res.status(200).json({ opportunities: rawResponse })
        }

        //CACHE MISS now generate and call AI
        console.log("Generating new AI Marketing Opportunities......")
        const inactiveThreshold = owner.inactiveThreshold || 30
        const vipOrderThreshold = owner.vipOrderThreshold || 5
        const minimumInactiveDate = new Date()
        minimumInactiveDate.setDate(minimumInactiveDate.getDate() - inactiveThreshold)
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const inactiveCustomers = await Customer.findAll({
            where: {
                userId: userId,
                lastOrderDate: { [Op.lt]: minimumInactiveDate }, [Op.or]: [
                    { lastMarketingSentAt: null }, // Never messaged
                    { lastMarketingSentAt: { [Op.lt]: sevenDaysAgo } } // Messaged > 7 days ago
                ]
            },
            limit: 5 // Limit to 5 to save AI tokens
        })
        //find vip customers
        const vipCustomers = await Customer.findAll({
            where: {
                userId: userId,
                totalOrders: { [Op.gte]: vipOrderThreshold },
                lastOrderDate: { [Op.gte]: minimumInactiveDate }, [Op.or]: [
                    { lastMarketingSentAt: null }, // Never messaged
                    { lastMarketingSentAt: { [Op.lt]: sevenDaysAgo } } // Messaged > 7 days ago
                ]
            },
            limit: 5
        })

        const allCandidates = [
            ...inactiveCustomers.map(c => ({ customer: c, type: 'WIN_BACK' })),
            ...vipCustomers.map(c => ({ customer: c, type: 'VIP_REWARD' }))
        ]
        // D. The AI Loop
        const newOpportunities = [];

        // Use Flash model for speed
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        for (const item of allCandidates) {
            const c = item.customer;

            // 1. Identify the "Hook" (What are we offering?)
            // If they have a favorite, use it. If not, use generic "your next order".
            const productHook = c.favoriteItem ? c.favoriteItem : "your next order";

            // 2. Define the Offer 
            // WIN_BACK = Aggressive discount to lure them back. 
            // VIP = Reward (BOGO) for loyalty.
            const offer = item.type === 'WIN_BACK' ? "20% Off" : "Buy 1 Get 1 Free";

            // 3. Dynamic Prompt
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

                // Save to DB
                const opp = await marketingOpportunities.create({
                    customerId: c.id,
                    type: item.type,
                    aiMessage: text,
                    status: 'PENDING',
                    userId: userId
                });

                // Attach customer data manually for the response so frontend doesn't need to refresh
                opp.dataValues.customer = c;
                newOpportunities.push(opp);

            } catch (err) {
                console.error("Gemini Error:", err);
                // Skip this one if AI fails to keep the loop going
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
    const action = req.body.action; // 'SENT', 'SNOOZED', or 'REJECTED'

    try {
        const opp = await marketingOpportunities.findByPk(oppId);
        if (!opp) return res.status(404).json({ message: "Not found" });

        if (action === 'SENT') {
            opp.status = 'SENT';
            // Update Customer "Last Seen" for marketing
            const customer = await Customer.findByPk(opp.customerId);
            customer.lastMarketingSentAt = new Date();
            await customer.save();

        } else if (action === 'SNOOZED') {
            // 🟡 Swipe Left logic
            opp.status = 'SNOOZED';
            const wakeUpDate = new Date();
            wakeUpDate.setDate(wakeUpDate.getDate() + 2); // Remind in 2 days
            opp.snoozeUntil = wakeUpDate;

        } else if (action === 'REJECTED') {
            // 🔴 "X" Button logic
            opp.status = 'DISMISSED';
            // We do NOT set a snooze date. It's dead.
        }

        await opp.save();
        res.status(200).json({ message: "Action recorded" });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Action failed" });
    }
};