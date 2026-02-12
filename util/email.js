exports.sendVerificationEmail = async (toEmail, code) => {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            "api-key": process.env.BREVO_API_KEY,
            "Content-Type": "application/json",
            "accept": "application/json",
        },
        body: JSON.stringify({
            sender: {
                email: process.env.FROM_EMAIL,
                name: process.env.FROM_NAME || "Flowly Security",
            },
            to: [{ email: toEmail }],
            subject: "Your Flowly Verification Code",
            htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #333;">Welcome to Flowly!</h2>
          <p style="color: #555;">To secure your account, please verify your email address using the code below:</p>
          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 4px; margin: 20px 0;">
            <h1 style="color: #4CAF50; letter-spacing: 5px; margin: 0;">${code}</h1>
          </div>
          <p style="color: #777; font-size: 12px;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
        </div>
      `,
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        console.error("❌ Brevo API email failed:", res.status, text);
        throw new Error("Could not send verification email. Please try again.");
    }

    console.log(`✅ Verification email sent to ${toEmail}`);
};
