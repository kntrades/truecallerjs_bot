const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');

// ========== CONFIGURATION ==========
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8558096238:AAEJncP3kdcaavmlkwng6LoPraaH16JxHAM';
const NUMVERIFY_API_KEY = process.env.NUMVERIFY_API_KEY || '45257ed8f00544fc46d388ad64adfe4a';
const PORT = process.env.PORT || 10000;

console.log('=== PROFESSIONAL PHONE LOOKUP BOT STARTING ===');
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

// ========== ERROR HANDLING ==========
bot.on('polling_error', (error) => {
    if (error.code === 409) {
        console.log('⚠️ 409 Conflict - Another instance detected. This will auto-resolve.');
    } else {
        console.error('Polling error:', error.code, error.message);
    }
});

// ========== SIMPLE USER DATABASE ==========
const users = {};

// ========== MAP COMMON SINGAPORE MVNOS ==========
const singaporeMVNOs = {
    'circles.life': 'Circles.Life',
    'gomo': 'GOMO',
    'giga': 'giga!',
    'zero1': 'Zero1',
    'myrepublic': 'MyRepublic Mobile',
    'vivifi': 'Vivifi',
    'changi': 'Changi Mobile',
    'circles': 'Circles.Life',
    'zero': 'Zero1'
};

// ========== HELPER FUNCTIONS ==========
function formatCarrier(carrier) {
    if (!carrier || carrier === 'null' || carrier === 'Null') {
        return 'Unknown Carrier';
    }
    
    if (carrier.toLowerCase() === 'mvno') {
        return 'Mobile Virtual Network Operator';
    }
    
    const lower = carrier.toLowerCase();
    for (const [key, name] of Object.entries(singaporeMVNOs)) {
        if (lower.includes(key)) {
            return `${name} (MVNO)`;
        }
    }
    
    return carrier;
}

function formatLocation(location, carrier, country) {
    if (!location || location === 'null' || location === 'Null' || location === 'MVNO') {
        if (carrier && carrier.toLowerCase() === 'mvno') {
            return `${country || 'Singapore'} (Mobile Network)`;
        }
        return country || 'Location not available';
    }
    return location;
}

function improveNumVerifyData(data) {
    const carrier = formatCarrier(data.carrier);
    const location = formatLocation(data.location, data.carrier, data.country_name);
    
    return {
        ...data,
        carrier: carrier,
        location: location
    };
}

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
            const improvedData = improveNumVerifyData(data);
            
            return {
                success: true,
                data: {
                    number: improvedData.international_format,
                    localFormat: improvedData.local_format,
                    country: improvedData.country_name,
                    countryCode: improvedData.country_code,
                    carrier: improvedData.carrier,
                    lineType: improvedData.line_type,
                    location: improvedData.location,
                    isValid: improvedData.valid
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
            message: 'API service temporarily unavailable. Please try again later.',
            balance: users[userId]?.balance || 0
        };
    }
}

// ========== EXPRESS SERVER ==========
const app = express();

app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Professional Phone Lookup Bot',
        services: [
            'Automated carrier lookup ($0.10)',
            'Manual deep search ($30)',
            'Business background checks'
        ],
        support: '@Moneymakingmachine8888',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ Web: https://truecallerjs-bot-6a35.onrender.com`);
});

// ========== BOT COMMANDS ==========

// Start command
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
    
    `🔍 *Our Services:*\n` +
    `1. *Automated Lookup* ($0.10)\n` +
    `   • Carrier identification\n` +
    `   • Location data\n` +
    `   • Line type detection\n\n` +
    
    `2. *Manual Deep Search* ($30)\n` +
    `   • Business background checks\n` +
    `   • Social media profiling\n` +
    `   • Public records search\n\n` +
    
    `💰 *Your Account:*\n` +
    `• Credits: ${users[userId].balance} (for automated lookup)\n` +
    `• Lookups used: ${users[userId].lookupsUsed}\n\n` +
    
    `📋 *Commands:*\n` +
    `/lookup [number] - Automated carrier lookup\n` +
    `/balance - Check credits\n` +
    `/payment - Buy credits for automated lookup\n` +
    `/deepsearch - Learn about manual research ($30)\n` +
    `/help - Support\n\n` +
    
    `📞 *Contact:* @Moneymakingmachine8888`;
    
    bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'Markdown'
    });
});

// ========== LOOKUP COMMAND ==========
bot.onText(/\/lookup (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const phoneNumber = match[1].trim();
    
    const searchingMsg = await bot.sendMessage(chatId,
        `🔍 *Searching...*\n\`${phoneNumber}\`\n⏳ Please wait...`,
        { parse_mode: 'Markdown' }
    );
    
    const result = await numVerifyLookup(phoneNumber, userId);
    
    if (result.success) {
        const data = result.data;
        const balance = result.balance;
        
        const disclaimer = `\n\n🔍 *SERVICE NOTE:*\n` +
                          `• Shows technical data only (carrier/location)\n` +
                          `• Names not available via automated API\n` +
                          `• For background checks: $30 manual research\n` +
                          `• Contact @Moneymakingmachine8888`;
        
        const aboutMVNO = data.carrier.includes('MVNO') ? 
            `\n💡 *MVNO:* Uses major network infrastructure` : '';
        
        const resultMessage = `✅ *AUTOMATED LOOKUP RESULTS*\n\n` +
                              `📱 *Phone Number:*\n\`${data.number}\`\n\n` +
                              `🌐 *Technical Data:*\n` +
                              `• Carrier: ${data.carrier}\n` +
                              `• Type: ${data.lineType}\n` +
                              `• Country: ${data.country}\n` +
                              `• Location: ${data.location}\n` +
                              aboutMVNO +
                              `\n\n💰 *Credits:* ${balance} remaining\n` +
                              `💵 *Cost:* $0.10 per lookup\n\n` +
                              `🔍 *Need background check?*\n` +
                              `Manual research: $30/search\n` +
                              `Contact @Moneymakingmachine8888` +
                              disclaimer;
        
        await bot.editMessageText(resultMessage, {
            chat_id: chatId,
            message_id: searchingMsg.message_id,
            parse_mode: 'Markdown'
        });
        
    } else {
        await bot.editMessageText(
            `❌ *Lookup Failed*\n${result.message}\n\nCredits: ${result.balance}\n/payment to recharge`,
            {
                chat_id: chatId,
                message_id: searchingMsg.message_id,
                parse_mode: 'Markdown'
            }
        );
    }
});

// ========== DEEP SEARCH COMMAND ==========
bot.onText(/\/deepsearch/, (msg) => {
    const chatId = msg.chat.id;
    
    const deepSearchMessage = `🇸🇬 *SINGAPORE DEEP SEARCH - $30/SEARCH*\n\n` +
    
    `🔍 *What We Research:*\n` +
    `• Business affiliations & licenses\n` +
    `• Company directorships\n` +
    `• Social media profile analysis\n` +
    `• Professional background verification\n` +
    `• Property ownership records\n` +
    `• Court case history\n` +
    `• Public records search\n\n` +
    
    `📋 *How It Works:*\n` +
    `1. You provide details (name/company)\n` +
    `2. We conduct manual investigation\n` +
    `3. You receive detailed report\n` +
    `4. Delivery: 48-72 hours\n\n` +
    
    `💵 *Price:* $30 per search\n` +
    `📞 *Contact:* @Moneymakingmachine8888\n\n` +
    
    `💡 *Note:* This is MANUAL research service\n` +
    `Not automated phone number lookup`;
    
    bot.sendMessage(chatId, deepSearchMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "📞 Contact for Deep Search", url: "https://t.me/Moneymakingmachine8888" }]
            ]
        }
    });
});

// ========== PAYMENT COMMAND ==========
bot.onText(/\/payment/, (msg) => {
    const chatId = msg.chat.id;
    
    const paymentMessage = `💰 *PAYMENT OPTIONS*\n\n` +
    
    `💳 *For Automated Lookup Credits:*\n` +
    `• 10 credits = $0.99\n` +
    `• 100 credits = $9.99\n` +
    `• 1000 credits = $49.99 ✅\n` +
    `• 5000 credits = $99.99\n\n` +
    
    `🔍 *For Manual Deep Search:*\n` +
    `• $30 per research project\n` +
    `• Contact @Moneymakingmachine8888\n\n` +
    
    `💸 *Payment Methods:*\n` +
    `🏦 **Wise Transfer**\n` +
    `Account: \`738120584057198\`\n` +
    `Currency: USD only\n\n` +
    
    `₿ **USDT (TRC-20)**\n` +
    `Address: \`TE3pMrHtiUu37NjYkdDo4hhJW3xekBiCPr\`\n` +
    `Network: TRC-20 only\n\n` +
    
    `📱 **PayNow (Singapore)**\n` +
    `UEN: \`202550900H\`\n\n` +
    
    `📞 *After payment:*\n` +
    `Send receipt to @Moneymakingmachine8888`;
    
    bot.sendMessage(chatId, paymentMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "💳 Buy Credits", callback_data: "buy_credits" }],
                [{ text: "🔍 Deep Search Info", callback_data: "deepsearch_info" }],
                [{ text: "📞 Contact", url: "https://t.me/Moneymakingmachine8888" }]
            ]
        }
    });
});

// ========== BALANCE COMMAND ==========
bot.onText(/\/balance/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!users[userId]) {
        users[userId] = { lookupsUsed: 0, balance: 5 };
    }
    
    const message = `💰 *YOUR ACCOUNT*\n\n` +
                   `*Automated Lookup Credits:* ${users[userId].balance}\n` +
                   `*Lookups Used:* ${users[userId].lookupsUsed}\n\n` +
                   `*Pricing:*\n` +
                   `• Automated: $0.10 per lookup\n` +
                   `• Manual Research: $30 per project\n\n` +
                   `/payment to buy credits`;
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// ========== HELP COMMAND ==========
bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `🆘 *HELP*\n\n` +
        `/start - Welcome & services\n` +
        `/lookup [number] - Automated carrier lookup\n` +
        `/deepsearch - Manual research service ($30)\n` +
        `/payment - Buy credits\n` +
        `/balance - Check credits\n\n` +
        `Support: @Moneymakingmachine8888`,
        { parse_mode: 'Markdown' }
    );
});

// ========== CALLBACK HANDLERS ==========
bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    
    bot.answerCallbackQuery(callbackQuery.id);
    
    if (data === 'buy_credits') {
        bot.sendMessage(chatId,
            `💰 *Buy Credits for Automated Lookup*\n\n` +
            `*Available Packages:*\n` +
            `• 10 credits = $0.99\n` +
            `• 100 credits = $9.99\n` +
            `• 1000 credits = $49.99 ✅\n` +
            `• 5000 credits = $99.99\n\n` +
            `*Payment Methods:*\n` +
            `1. Wise Transfer\n` +
            `2. USDT (TRC-20)\n` +
            `3. PayNow (Singapore)\n\n` +
            `Use /payment for payment details`,
            { parse_mode: 'Markdown' }
        );
    } else if (data === 'deepsearch_info') {
        bot.sendMessage(chatId,
            `🔍 *Deep Search Service - $30*\n\n` +
            `*What we investigate:*\n` +
            `• Business background checks\n` +
            `• Professional verification\n` +
            `• Social media analysis\n` +
            `• Public records search\n\n` +
            `*Contact:* @Moneymakingmachine8888`,
            { parse_mode: 'Markdown' }
        );
    }
});

// ========== BOT STARTUP ==========
bot.getMe().then((botInfo) => {
    console.log('========================================');
    console.log('✅ PROFESSIONAL LOOKUP BOT STARTED!');
    console.log(`✅ Bot: @${botInfo.username}`);
    console.log('========================================');
    console.log('💰 Services:');
    console.log('   1. Automated lookup ($0.10)');
    console.log('   2. Manual deep search ($30)');
    console.log('========================================');
    console.log('💳 Payment Methods:');
    console.log('   • Wise Transfer');
    console.log('   • USDT (TRC-20)');
    console.log('   • PayNow Singapore');
    console.log('========================================');
    console.log('📞 Support: @Moneymakingmachine8888');
    console.log('========================================');
});

console.log('🚀 Professional Lookup Bot ready!');
