const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Telegram Bot Token
const token = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN';

// Create bot instance
const bot = new TelegramBot(token, { polling: true });

// Express server for Render
const app = express();
const PORT = process.env.PORT || 10000;

// Health check endpoint
app.get('/', (req, res) => {
    res.send('✅ Bot server is running');
});

app.listen(PORT, () => {
    console.log(`✅ Bot server running on port ${PORT}`);
});

// Bot is ready
bot.on('polling_error', (error) => {
    console.log('Polling error:', error);
});

// Start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 
        `Welcome to No 1 Phone Search Program Bot! 📱\n\n` +
        `Available commands:\n` +
        `/start - Show this message\n` +
        `/payment - Show payment options\n` +
        `/info - Bot information\n\n` +
        `Contact: @Moneymakingmachine8888`,
        { parse_mode: 'Markdown' }
    );
});

// Info command
bot.onText(/\/info/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 
        `🤖 *Bot Information*\n\n` +
        `• Bot Name: No 1 Phone Search Program\n` +
        `• Version: 1.0.0\n` +
        `• Features: Phone lookup service\n` +
        `• Contact: @Moneymakingmachine8888\n\n` +
        `Use /payment to see payment options.`,
        { parse_mode: 'Markdown' }
    );
});

// ========== PAYMENT COMMAND ==========
bot.onText(/\/payment/, (msg) => {
    const chatId = msg.chat.id;
    
    const paymentMessage = `<b>💰 BANK OF CHINA STYLED PAYMENT PORTAL</b>
    
🏦 <b>Secure Payment Gateway</b>
<i>No 1 Phone Search Program - Advanced Phone Lookup Service</i>

━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🎯 SELECT YOUR PLAN (USD ONLY)</b>

<b>💼 BASIC ACCOUNT</b>
• Price: $24.99 USD
• 50 searches per month
• Basic lookup features

<b>⭐ PREMIUM ACCOUNT (RECOMMENDED)</b>
• Price: $49.99 USD
• Unlimited searches
• Real-time data & reports
• Priority support

<b>🏢 BUSINESS ACCOUNT</b>
• Price: $99.99 USD
• All Premium features
• API access
• Team management

━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>💳 PAYMENT METHODS</b>

<b>🅿️ PayPal Secure Gateway</b>
<code>https://www.paypal.com/ncp/payment/8RX8ZKB38B9HG</code>

<b>🏦 Bank Transfer (Wise)</b>
<code>Account: 738120584057198</code>
<code>Currency: USD Only</code>

<b>₿ Cryptocurrency (USDT TRC-20)</b>
<code>Address: TE3pMrHtiUu37NjYkdDo4hhJW3xekBiCPr</code>

<b>📱 PayNow (Singapore Only)</b>
<code>UEN: 202550900H</code>

━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>📞 POST-PAYMENT INSTRUCTIONS</b>

1. Complete payment in <b>USD only</b>
2. Save your payment receipt
3. Contact: @Moneymakingmachine8888
4. Send receipt for activation
5. Access granted within 24 hours

<b>🔒 Bank-Level Security • Encrypted Transactions</b>`;

    const options = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "💳 Pay with PayPal", url: "https://www.paypal.com/ncp/payment/8RX8ZKB38B9HG" }],
                [{ text: "📞 Contact Support", url: "https://t.me/Moneymakingmachine8888" }],
                [
                    { text: "💰 Wise Info", callback_data: "wise" },
                    { text: "₿ Crypto Info", callback_data: "crypto" }
                ],
                [{ text: "✅ Payment Completed", callback_data: "completed" }]
            ]
        }
    };

    bot.sendMessage(chatId, paymentMessage, options);
});

// Handle callback queries
bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    if (data === 'wise') {
        bot.sendMessage(chatId, 
            `<b>🏦 Wise Transfer Instructions:</b>\n\n` +
            `<code>Account: 738120584057198</code>\n\n` +
            `• Transfer in <b>USD only</b>\n` +
            `• Include your Telegram username\n` +
            `• Send receipt to @Moneymakingmachine8888\n\n` +
            `💰 <i>Bank-level security guaranteed</i>`,
            { parse_mode: 'HTML' }
        );
    } else if (data === 'crypto') {
        bot.sendMessage(chatId,
            `<b>₿ Cryptocurrency Payment:</b>\n\n` +
            `<code>Wallet: TE3pMrHtiUu37NjYkdDo4hhJW3xekBiCPr</code>\n\n` +
            `• Network: <b>TRC-20 only</b>\n` +
            `• Token: USDT (Tether)\n` +
            `• Amount: USD equivalent of chosen plan\n\n` +
            `⚠️ <i>Other tokens/networks will be lost</i>`,
            { parse_mode: 'HTML' }
        );
    } else if (data === 'completed') {
        bot.sendMessage(chatId,
            `✅ <b>Payment Received!</b>\n\n` +
            `Please send your payment receipt to:\n` +
            `<b>@Moneymakingmachine8888</b>\n\n` +
            `Include:\n` +
            `• Your Telegram username\n` +
            `• Payment method used\n` +
            `• Plan selected\n\n` +
            `⏱️ <i>Activation within 24 hours</i>`,
            { parse_mode: 'HTML' }
        );
    }

    bot.answerCallbackQuery(callbackQuery.id);
});

// Log when bot is ready
bot.getMe().then((botInfo) => {
    console.log(`✅ Bot username: @${botInfo.username}`);
    console.log(`✅ Use /payment command in Telegram`);
});

console.log('✅ Bot is starting...');
