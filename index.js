const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');

// ========== CONFIGURATION ==========
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8558096238:AAEJncP3kdcaavmlkwng6LoPraaH16JxHAM';
const NUMVERIFY_API_KEY = process.env.NUMVERIFY_API_KEY || '45257ed8f00544fc46d388ad64adfe4a';
const PORT = process.env.PORT || 10000;

console.log('=== NUMVERIFY PHONE LOOKUP BOT STARTING ===');
console.log('Bot Token:', TOKEN.substring(0, 10) + '...');
console.log('NumVerify API Key:', NUMVERIFY_API_KEY.substring(0, 8) + '...');
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

// ========== SIMPLE USER DATABASE ==========
const users = {};

// ========== NUMVERIFY LOOKUP FUNCTION ==========
async function numVerifyLookup(phoneNumber, userId) {
    try {
        console.log(`🔍 NumVerify lookup for: ${phoneNumber} by user ${userId}`);
        
        if (!users[userId]) {
            users[userId] = { lookupsUsed: 0, plan: 'free', balance: 5 };
        }
        
        if (users[userId].balance <= 0) {
            return {
                success: false,
                message: '❌ No balance remaining. Please recharge with /payment.',
                balance: users[userId].balance
            };
        }
        
        const response = await axios.get('http://apilayer.net/api/validate', {
            params: {
                access_key: NUMVERIFY_API_KEY,
                number: phoneNumber,
                format: 1,
                country_code: ''
            },
            timeout: 10000
        });
        
        const data = response.data;
        
        users[userId].lookupsUsed += 1;
        users[userId].balance -= 1;
        
        console.log(`✅ Lookup successful. User ${userId} balance: ${users[userId].balance}`);
        
        if (data.valid) {
            return {
                success: true,
                data: {
                    number: data.international_format,
                    localFormat: data.local_format,
                    country: data.country_name,
                    countryCode: data.country_code,
                    carrier: data.carrier || 'Unknown',
                    lineType: data.line_type,
                    location: data.location || 'Unknown',
                    isValid: data.valid
                },
                balance: users[userId].balance,
                cost: 1
            };
        } else {
            return {
                success: false,
                message: 'Invalid phone number format',
                balance: users[userId].balance
            };
        }
        
    } catch (error) {
        console.error('❌ NumVerify API error:', error.message);
        return {
            success: false,
            message: 'API service temporarily unavailable.',
            balance: users[userId]?.balance || 0
        };
    }
}

// ========== EXPRESS SERVER ==========
const app = express();

app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'NumVerify Phone Lookup Bot',
        pricing: '$0.10 per lookup',
        free_credits: '5 per new user',
        support: '@Moneymakingmachine8888',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ Health check: https://truecallerjs-bot-6a35.onrender.com/`);
});

// ========== BOT COMMANDS ==========

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.first_name || 'User';
    
    if (!users[userId]) {
        users[userId] = {
            lookupsUsed: 0,
            plan: 'free',
            balance: 5,
            joined: new Date().toISOString()
        };
    }
    
    const welcomeMessage = `👋 *Welcome ${userName}!*\n\n` +
    `🔍 *NumVerify Phone Lookup Service*\n` +
    `• Real-time number validation\n` +
    `• Carrier identification\n` +
    `• Country & location data\n\n` +
    `💰 *Your Account:*\n` +
    `• Credits: ${users[userId].balance}\n` +
    `• Lookups used: ${users[userId].lookupsUsed}\n\n` +
    `📋 *Commands:*\n` +
    `/lookup [number] - Search phone number\n` +
    `/balance - Check credits\n` +
    `/payment - Buy more credits\n` +
    `/help - Support\n\n` +
    `💡 *Example:* /lookup +6512345678\n\n` +
    `📞 *Support:* @Moneymakingmachine8888`;
    
    bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'Markdown'
    });
});

bot.onText(/\/lookup (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const phoneNumber = match[1].trim();
    const userName = msg.from.first_name || 'User';
    
    console.log(`🔍 Lookup request: ${phoneNumber}`);
    
    if (!phoneNumber.match(/^[+]?[0-9\s\-\(\)]{10,}$/)) {
        return bot.sendMessage(chatId,
            `❌ *Invalid Format*\n\nUse:\n\`/lookup +6512345678\`\n\`/lookup 91234567\``,
            { parse_mode: 'Markdown' }
        );
    }
    
    const searchingMsg = await bot.sendMessage(chatId,
        `🔍 *Searching...*\nNumber: \`${phoneNumber}\`\n⏳ Please wait...`,
        { parse_mode: 'Markdown' }
    );
    
    const result = await numVerifyLookup(phoneNumber, userId);
    
    if (result.success) {
        const data = result.data;
        const balance = result.balance;
        
        const resultMessage = `✅ *LOOKUP RESULTS*\n\n` +
                              `📱 *Number:* \`${data.number}\`\n` +
                              `🌍 *Country:* ${data.country}\n` +
                              `🏢 *Carrier:* ${data.carrier}\n` +
                              `📞 *Type:* ${data.lineType}\n` +
                              `📍 *Location:* ${data.location}\n\n` +
                              `💰 *Credits:* ${balance} remaining\n` +
                              `💵 *Cost:* $0.10 USD\n\n` +
                              `Need more? /payment`;
        
        await bot.editMessageText(resultMessage, {
            chat_id: chatId,
            message_id: searchingMsg.message_id,
            parse_mode: 'Markdown'
        });
        
    } else {
        await bot.editMessageText(
            `❌ *Failed*\n${result.message}\n\nCredits: ${result.balance}\n/payment to recharge`,
            {
                chat_id: chatId,
                message_id: searchingMsg.message_id,
                parse_mode: 'Markdown'
            }
        );
    }
});

bot.onText(/\/balance/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!users[userId]) {
        users[userId] = { lookupsUsed: 0, plan: 'free', balance: 5 };
    }
    
    const user = users[userId];
    
    const balanceMessage = `💰 *ACCOUNT*\n\n` +
                          `*Credits:* ${user.balance}\n` +
                          `*Used:* ${user.lookupsUsed}\n` +
                          `*Plan:* ${user.plan}\n\n` +
                          `*Packages:*\n` +
                          `• 10 credits = $0.99\n` +
                          `• 100 credits = $9.99\n` +
                          `• 1000 credits = $49.99\n\n` +
                          `/payment to buy`;
    
    bot.sendMessage(chatId, balanceMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/payment/, (msg) => {
    const chatId = msg.chat.id;
    
    const paymentMessage = `💰 *BUY CREDITS*\n\n` +
                          `*Packages:*\n` +
                          `🟢 10 credits = $0.99\n` +
                          `🔵 100 credits = $9.99\n` +
                          `🟡 1000 credits = $49.99 ✅\n` +
                          `🔴 5000 credits = $99.99\n\n` +
                          `*Payment Methods:*\n` +
                          `🅿️ PayPal: https://paypal.com/ncp/payment/8RX8ZKB38B9HG\n` +
                          `🏦 Wise: 738120584057198\n` +
                          `₿ USDT: TE3pMrHtiUu37NjYkdDo4hhJW3xekBiCPr\n` +
                          `📱 PayNow: 202550900H\n\n` +
                          `*After payment:*\n` +
                          `Send receipt to @Moneymakingmachine8888`;
    
    bot.sendMessage(chatId, paymentMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "💳 Pay with PayPal", url: "https://paypal.com/ncp/payment/8RX8ZKB38B9HG" }],
                [{ text: "📞 Contact", url: "https://t.me/Moneymakingmachine8888" }]
            ]
        }
    });
});

bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `🆘 *Help*\n\n` +
        `/start - Register\n` +
        `/lookup [number] - Search\n` +
        `/balance - Check credits\n` +
        `/payment - Buy credits\n\n` +
        `Support: @Moneymakingmachine8888`,
        { parse_mode: 'Markdown' }
    );
});

bot.getMe().then((botInfo) => {
    console.log('================================');
    console.log('✅ NUMVERIFY BOT STARTED!');
    console.log(`✅ Bot: @${botInfo.username}`);
    console.log('================================');
});

console.log('🚀 Bot ready!');
