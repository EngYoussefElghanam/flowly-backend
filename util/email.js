const nodemailer = require('nodemailer');

// 1. Configure the Transporter for Brevo
const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com', // Brevo's SMTP server
    port: 587, // Standard secure port
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.BREVO_EMAIL,
        pass: process.env.BREVO_PASS
    }
});

// 2. The Send Function
exports.sendVerificationEmail = async (toEmail, code) => {
    try {
        await transporter.sendMail({
            from: '"Flowly Security" <youssefelghanam694@gmail.com>', // Professional sender name
            to: toEmail,
            subject: 'Your Flowly Verification Code',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #333;">Welcome to Flowly!</h2>
                    <p style="color: #555;">To secure your account, please verify your email address using the code below:</p>
                    
                    <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 4px; margin: 20px 0;">
                        <h1 style="color: #4CAF50; letter-spacing: 5px; margin: 0;">${code}</h1>
                    </div>
                    
                    <p style="color: #777; font-size: 12px;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
                </div>
            `
        });
        console.log(`✅ Verification email sent to ${toEmail}`);
    } catch (err) {
        console.error("❌ Email failed:", err);
        // We throw the error so the controller knows it failed
        throw new Error("Could not send verification email. Please try again.");
    }
};