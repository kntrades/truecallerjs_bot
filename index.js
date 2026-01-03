const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// ========== CONFIGURATION ==========
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8558096238:AAEJncP3kdcaavmlkwng6LoPraaH16JxHAM';
const PORT = process.env.PORT || 10000;

console.log('=== PAYMENT BOT STARTING ===');
console.log('Bot Token:', TOKEN.substring(0, 10) + '...');
console.log('Port:', PORT);

// ========== CREATE BOT ==========
const bot = new TelegramBot(TOKEN, {
    polling: {
        interval: 1000,
        autoStart: true,
        params: {
            timeout: 30,
            allowed_updates: ['message', 'callback_query']
        }
    }
});

// ========== EXPRESS SERVER (FOR RENDER) ==========
const app = express();

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'No1PhoneSearchBot Payment Service',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ Health check: https://your-render-url.onrender.com/`);
});

// ========== ERROR HANDLING ==========
bot.on('polling_error', (error) => {
    console.error('❌ Telegram API Error:', error.code, error.message);
    
    // Don't exit on error, just log it
    if (error.code === 'ETELEGRAM') {
        console.log('⚠️ Telegram API issue, but bot continues...');
    }
});

bot.on('error', (error) => {
    console.error('❌ General bot error:', error.message);
});

// ========== BOT COMMANDS ==========

// Start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name || 'User';
    
    console.log(`👋 /start from ${userName} (${chatId})`);
    
    const welcomeMessage = `👋 Hello ${userName}!

🤖 *Welcome to No 1 Phone Search Program Bot*

🔍 *Features:*
• Advanced phone number lookup
• Real-time data access
• Unlimited search capabilities

💳 *Payment Plans:*
• Basic: $24.99 USD
• Pro: $49.99 USD (Recommended)
• Business: $99.99 USD

📋 *Commands:*
/start - Welcome message
/payment - View payment options
/help - Get assistance

📞 *Support:* @Moneymakingmachine8888

_All payments in USD only_`;

    bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'Markdown'
    });
});

// ========== PAYMENT COMMAND (MAIN FEATURE) ==========
bot.onText(/\/payment/, (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name || 'Customer';
    
    console.log(`💰 /payment request from ${userName} (${chatId})`);
    
    const paymentMessage = `<b>💰 NO 1 PHONE SEARCH PROGRAM - PAYMENT PORTAL</b>

🏦 <i>Secure Payment Gateway</i>

━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🎯 SELECT YOUR PLAN (USD ONLY)</b>

<b>💼 BASIC PLAN</b>
• Price: <b>$24.99 USD</b>
• 50 searches per month
• Basic lookup features
• Email support

<b>⭐ PRO PLAN (RECOMMENDED)</b>
• Price: <b>$49.99 USD</b>
• Unlimited searches
• Real-time data & reports
• Priority support
• Dashboard access

<b>🏢 BUSINESS PLAN</b>
• Price: <b>$99.99 USD</b>
• All Pro features
• API access
• Team accounts (up to 5 users)
• Dedicated support

━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>💳 PAYMENT METHODS</b>

<b>🅿️ PayPal (Recommended)</b>
<code>Link: https://www.paypal.com/ncp/payment/8RX8ZKB38B9HG</code>

<b>🏦 Bank Transfer (Wise)</b>
<code>Account: 738120584057198</code>
<code>Currency: USD Only</code>

<b>₿ Cryptocurrency (USDT TRC-20)</b>
<code>Address: TE3pMrHtiUu37NjYkdDo4hhJW3xekBiCPr</code>
<code>Network: TRC-20 ONLY</code>

<b>📱 PayNow (Singapore Only)</b>
<code>UEN: 202550900H</code>

━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>📞 POST-PAYMENT INSTRUCTIONS</b>

1. Complete payment in <b>USD only</b>
2. Save payment receipt/screenshot
3. Contact: <b>@Moneymakingmachine8888</b>
4. Send receipt + Telegram username
5. Access granted within 24 hours

<b>⚠️ IMPORTANT NOTES:</b>
• Singapore users: Deep Search ($30/search) available via PM
• All payments must be in USD
• Include your Telegram username in payment reference

<b>🔒 Bank-Level Security • Encrypted Transactions</b>`;

    const options = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [
                    { 
                        text: "💳 Pay with PayPal", 
                        url: "https://www.paypal.com/ncp/payment/8RX8ZKB38B9HG" 
                    }
                ],
                [
                    { 
                        text: "📞 Contact Support", 
                        url: "https://t.me/Moneymakingmachine8888" 
                    }
                ],
                [
                    { text: "💰 Wise Info", callback_data: "wise_info" },
                    { text: "₿ Crypto Info", callback_data: "crypto_info" }
                ],
                [
                    { text: "✅ Payment Made", callback_data: "payment_made" }
                ]
            ]
        }
    };

    bot.sendMessage(chatId, paymentMessage, options)
        .then(() => {
            console.log(`✅ Payment menu sent to ${userName}`);
        })
        .catch(err => {
            console.error(`❌ Failed to send to ${chatId}:`, err.message);
        });
});

// ========== CALLBACK QUERIES ==========
bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;

    console.log(`🔄 Callback from ${userId}: ${data}`);

    // Answer callback immediately
    bot.answerCallbackQuery(callbackQuery.id);

    if (data === 'wise_info') {
        bot.sendMessage(chatId, 
            `<b>🏦 Wise Transfer Instructions:</b>\n\n` +
            `<code>Account Number: 738120584057198</code>\n\n` +
            `• Transfer in <b>USD only</b>\n` +
            `• Include your Telegram username in reference\n` +
            `• Send receipt to @Moneymakingmachine8888\n\n` +
            `💡 <i>Recommended for international transfers</i>`,
            { parse_mode: 'HTML' }
        );
    } 
    else if (data === 'crypto_info') {
        bot.sendMessage(chatId,
            `<b>₿ Cryptocurrency Payment (USDT):</b>\n\n` +
            `<code>Wallet: TE3pMrHtiUu37NjYkdDo4hhJW3xekBiCPr</code>\n\n` +
            `• Network: <b>TRC-20 ONLY</b> (Tron)\n` +
            `• Token: USDT (Tether)\n` +
            `• Amount: USD equivalent of your chosen plan\n` +
            `• Send receipt to @Moneymakingmachine8888\n\n` +
            `⚠️ <i>Other tokens/networks will be lost</i>`,
            { parse_mode: 'HTML' }
        );
    }
    else if (data === 'payment_made') {
        bot.sendMessage(chatId,
            `✅ <b>Thank you for your payment!</b>\n\n` +
            `Please send your payment receipt to:\n` +
            `<b>@Moneymakingmachine8888</b>\n\n` +
            `📋 <b>Include in your message:</b>\n` +
            `• Your Telegram username\n` +
            `• Payment method used\n` +
            `• Plan selected\n` +
            `• Payment date/time\n\n` +
            `⏱️ <i>Activation within 24 hours of verification</i>\n` +
            `📧 <i>Email: support@blackworks.gl</i>`,
            { parse_mode: 'HTML' }
        );
    }
});

// ========== HELP COMMAND ==========
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    
    bot.sendMessage(chatId,
        `🆘 <b>Help & Support</b>\n\n` +
        `<b>Common Issues:</b>\n` +
        `• Payment not showing? Contact @Moneymakingmachine8888\n` +
        `• Need invoice? Provide email address\n` +
        `• Singapore users: PM for Deep Search add-on\n\n` +
        `<b>Contact Support:</b>\n` +
        `• Telegram: @Moneymakingmachine8888\n` +
        `• Email: support@blackworks.gl\n\n` +
        `<b>Response Time:</b> Within 24 hours`,
        { parse_mode: 'HTML' }
    );
});

// ========== BOT READY CONFIRMATION ==========
bot.getMe().then((botInfo) => {
    console.log('================================');
    console.log('✅ BOT SUCCESSFULLY STARTED!');
    console.log(`✅ Bot: @${botInfo.username}`);
    console.log(`✅ Name: ${botInfo.first_name}`);
    console.log(`✅ ID: ${botInfo.id}`);
    console.log('================================');
    console.log('✅ Use commands:');
    console.log('   /start - Welcome message');
    console.log('   /payment - Payment options');
    console.log('   /help - Support');
    console.log('================================');
}).catch((error) => {
    console.error('❌ Bot initialization failed:', error.message);
});

console.log('🚀 Payment bot initialization complete!');
