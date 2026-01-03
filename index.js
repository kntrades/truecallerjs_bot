const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');

// ========== CONFIGURATION ==========
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const NUMVERIFY_API_KEY = process.env.NUMVERIFY_API_KEY;
const PORT = process.env.PORT || 3000;
const ADMIN_USER_ID = process.env.ADMIN_USER_ID || 'YOUR_TELEGRAM_ID_HERE'; // Optional: for admin commands

// ========== VALIDATION ==========
if (!TOKEN) {
    console.error('❌ ERROR: TELEGRAM_BOT_TOKEN environment variable is required');
    console.log('Get token from @BotFather on Telegram');
    process.exit(1);
}

if (!NUMVERIFY_API_KEY) {
    console.error('❌ ERROR: NUMVERIFY_API_KEY environment variable is required');
    console.log('Get API key from numverify.com');
    process.exit(1);
}

console.log('✅ Environment variables loaded successfully');
console.log('✅ Bot starting...');

// ========== CREATE BOT ==========
const bot = new TelegramBot(TOKEN, {
    polling: {
        interval: 1000,
        autoStart: true,
        params: {
            timeout: 30,
            allowed_updates: ['message', 'callback_query', 'inline_query']
        }
    }
});

// ========== USER DATABASE ==========
const users = {};

// ========== ANALYTICS ==========
const analytics = {
    totalLookups: 0,
    countries: {},
    successfulLookups: 0,
    failedLookups: 0,
    totalUsers: 0,
    activeToday: new Set()
};

// ========== RATE LIMITING ==========
const rateLimit = {};
const RATE_LIMIT = 10; // 10 requests per minute

function checkRateLimit(userId) {
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    
    if (!rateLimit[userId]) {
        rateLimit[userId] = { [minute]: 1 };
        return true;
    }
    
    if (!rateLimit[userId][minute]) {
        rateLimit[userId] = { [minute]: 1 };
        return true;
    }
    
    if (rateLimit[userId][minute] >= RATE_LIMIT) {
        return false;
    }
    
    rateLimit[userId][minute]++;
    return true;
}

// ========== MAP COMMON SINGAPORE MVNOS ==========
const singaporeMVNOs = {
    'circles.life': 'Circles.Life',
    'gomo': 'GOMO',
    'giga': 'giga!',
    'zero1': 'Zero1',
    'myrepublic': 'MyRepublic Mobile',
    'vivifi': 'Vivifi',
    'changi': 'Changi Mobile',
    'cmlink': 'CM Link'
};

// ========== HELPER FUNCTIONS ==========
function validatePhoneNumber(number) {
    // Remove all non-numeric characters except +
    const cleaned = number.replace(/[^\d+]/g, '');
    
    // Basic validation
    if (!/^\+?[1-9]\d{1,14}$/.test(cleaned)) {
        return false;
    }
    
    // Limit length
    if (cleaned.length > 15) {
        return false;
    }
    
    return cleaned;
}

function formatCarrier(carrier) {
    if (!carrier || carrier.toLowerCase() === 'null') {
        return 'Unknown Carrier';
    }
    
    const lower = carrier.toLowerCase();
    
    // Check for MVNOs first
    for (const [key, name] of Object.entries(singaporeMVNOs)) {
        if (lower.includes(key)) {
            return `${name} (MVNO)`;
        }
    }
    
    // Major carriers
    if (lower.includes('singtel')) return 'Singtel';
    if (lower.includes('starhub')) return 'StarHub';
    if (lower.includes('m1')) return 'M1';
    
    return carrier;
}

function formatLocation(location, carrier, country) {
    if (!location || location === 'null' || location === 'Null') {
        if (carrier && carrier.toLowerCase().includes('mvno')) {
            return `${country || 'Singapore'} (Mobile Network)`;
        }
        return country || 'Location not available';
    }
    return location;
}

// ========== NUMVERIFY LOOKUP FUNCTION ==========
async function numVerifyLookup(phoneNumber, userId) {
    try {
        console.log(`🔍 NumVerify lookup for: ${phoneNumber} by user ${userId}`);
        
        // Initialize user if not exists
        if (!users[userId]) {
            users[userId] = { 
                lookupsUsed: 0, 
                plan: 'free', 
                balance: 5,
                joined: new Date().toISOString(),
                lastActivity: Date.now()
            };
            analytics.totalUsers++;
        }
        
        // Check rate limit
        if (!checkRateLimit(userId)) {
            return {
                success: false,
                message: '❌ Rate limit exceeded. Please wait 1 minute.',
                balance: users[userId].balance
            };
        }
        
        // Check balance
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
        
        // Update analytics
        analytics.totalLookups++;
        users[userId].lookupsUsed += 1;
        users[userId].balance -= 1;
        users[userId].lastActivity = Date.now();
        analytics.activeToday.add(userId);
        
        console.log(`✅ Lookup successful. User ${userId} balance: ${users[userId].balance}`);
        
        if (data.valid) {
            analytics.successfulLookups++;
            
            // Format data
            const carrier = formatCarrier(data.carrier);
            const location = formatLocation(data.location, data.carrier, data.country_name);
            const country = data.country_name || 'Unknown';
            
            // Update country analytics
            analytics.countries[country] = (analytics.countries[country] || 0) + 1;
            
            return {
                success: true,
                data: {
                    number: data.international_format,
                    localFormat: data.local_format,
                    country: country,
                    countryCode: data.country_code,
                    carrier: carrier,
                    lineType: data.line_type,
                    location: location,
                    isValid: data.valid
                },
                balance: users[userId].balance,
                cost: 1
            };
        } else {
            analytics.failedLookups++;
            return {
                success: false,
                message: 'Invalid phone number format',
                balance: users[userId].balance
            };
        }
        
    } catch (error) {
        console.error('❌ NumVerify API error:', error.message);
        analytics.failedLookups++;
        return {
            success: false,
            message: 'API service temporarily unavailable. Please try again later.',
            balance: users[userId]?.balance || 0
        };
    }
}

// ========== EXPRESS SERVER ==========
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Professional Phone Lookup Bot',
        version: '2.0',
        timestamp: new Date().toISOString(),
        endpoints: ['GET /', 'GET /health', 'GET /stats'],
        uptime: process.uptime()
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        lookupsToday: analytics.totalLookups
    });
});

app.get('/stats', (req, res) => {
    if (req.query.key !== process.env.ADMIN_KEY) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    res.json({
        analytics: {
            totalLookups: analytics.totalLookups,
            successfulLookups: analytics.successfulLookups,
            failedLookups: analytics.failedLookups,
            totalUsers: analytics.totalUsers,
            activeToday: analytics.activeToday.size,
            topCountries: Object.entries(analytics.countries)
                .sort((a,b) => b[1] - a[1])
                .slice(0, 10)
        }
    });
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});

// ========== SCHEDULED CLEANUP ==========
setInterval(() => {
    const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    let cleaned = 0;
    
    for (const [userId, userData] of Object.entries(users)) {
        if (userData.lastActivity && userData.lastActivity < oneMonthAgo) {
            delete users[userId];
            cleaned++;
        }
    }
    
    if (cleaned > 0) {
        console.log(`🧹 Cleaned ${cleaned} inactive users`);
    }
    
    // Reset daily active users
    analytics.activeToday.clear();
}, 24 * 60 * 60 * 1000);

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
            joined: new Date().toISOString(),
            lastActivity: Date.now()
        };
        analytics.totalUsers++;
    }
    
    users[userId].lastActivity = Date.now();
    
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
    
    `3. *Bulk Processing*\n` +
    `   • CSV file processing\n` +
    `   • Volume discounts available\n\n` +
    
    `💰 *Your Account:*\n` +
    `• Credits: ${users[userId].balance}\n` +
    `• Lookups used: ${users[userId].lookupsUsed}\n\n` +
    
    `📋 *Commands:*\n` +
    `/lookup [number] - Automated carrier lookup\n` +
    `/balance - Check credits\n` +
    `/payment - Buy credits\n` +
    `/deepsearch - Manual research ($30)\n` +
    `/bulk - Bulk processing info\n` +
    `/share - Share bot with friends\n` +
    `/referral - Get referral link\n` +
    `/help - Support & full guide\n\n` +
    
    `📞 *Contact:* @Moneymakingmachine8888`;
    
    bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'Markdown'
    });
});

// ========== LOOKUP COMMAND ==========
bot.onText(/\/lookup (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const rawNumber = match[1].trim();
    
    // Validate phone number
    const phoneNumber = validatePhoneNumber(rawNumber);
    if (!phoneNumber) {
        return bot.sendMessage(chatId, 
            '❌ Invalid phone number format.\n' +
            'Please use format: +6512345678 or 6512345678',
            { parse_mode: 'Markdown' }
        );
    }
    
    const searchingMsg = await bot.sendMessage(chatId,
        `🔍 *Searching...*\n\`${phoneNumber}\`\n⏳ Please wait...`,
        { parse_mode: 'Markdown' }
    );
    
    const result = await numVerifyLookup(phoneNumber, userId);
    
    if (result.success) {
        const data = result.data;
        const balance = result.balance;
        
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
                              `Contact @Moneymakingmachine8888`;
        
        await bot.editMessageText(resultMessage, {
            chat_id: chatId,
            message_id: searchingMsg.message_id,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "🔍 Another Lookup", switch_inline_query_current_chat: "" },
                        { text: "💰 Buy Credits", callback_data: "buy_credits" }
                    ],
                    [
                        { text: "📞 Contact for Deep Search", url: "https://t.me/Moneymakingmachine8888" }
                    ]
                ]
            }
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

// ========== INLINE QUERY SUPPORT ==========
bot.on('inline_query', async (query) => {
    const phoneNumber = query.query.trim();
    if (!phoneNumber || phoneNumber.length < 4) return;
    
    const results = [{
        type: 'article',
        id: '1',
        title: `🔍 Lookup: ${phoneNumber}`,
        description: 'Click to perform phone number lookup',
        input_message_content: {
            message_text: `🔍 Looking up: \`${phoneNumber}\`...\n\nUse /lookup command for detailed results`,
            parse_mode: 'Markdown'
        },
        reply_markup: {
            inline_keyboard: [[
                { text: '🔍 Perform Full Lookup', callback_data: `inline_lookup_${phoneNumber}` }
            ]]
        }
    }];
    
    bot.answerInlineQuery(query.id, results);
});

// ========== PAYMENT COMMAND (SECURE VERSION) ==========
bot.onText(/\/payment/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    const paymentMessage = `💰 *PAYMENT OPTIONS*\n\n` +
    
    `💳 *For Automated Lookup Credits:*\n` +
    `• 10 credits = $0.99\n` +
    `• 100 credits = $9.99\n` +
    `• 1000 credits = $49.99 ✅\n` +
    `• 5000 credits = $99.99\n\n` +
    
    `🔍 *For Manual Deep Search:*\n` +
    `• $30 per research project\n` +
    `• Contact @Moneymakingmachine8888\n\n` +
    
    `💸 *Payment Methods Available:*\n` +
    `• Wise Transfer\n` +
    `• USDT (TRC-20)\n` +
    `• PayNow (Singapore)\n\n` +
    
    `📞 *To get payment details:*\n` +
    `1. Message @Moneymakingmachine8888\n` +
    `2. Specify amount/credits needed\n` +
    `3. Receive payment instructions\n` +
    `4. Send receipt for credit activation\n\n` +
    
    `💡 *Tip:* Mention "Bot Payment" for faster response`;
    
    bot.sendMessage(chatId, paymentMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "📱 Contact for Payment Details", url: "https://t.me/Moneymakingmachine8888" }],
                [{ text: "💰 Check Balance", callback_data: "check_balance" }],
                [{ text: "🔍 Deep Search Info", callback_data: "deepsearch_info" }]
            ]
        }
    });
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
                [{ text: "📞 Contact for Deep Search", url: "https://t.me/Moneymakingmachine8888" }],
                [{ text: "💰 Payment Methods", callback_data: "payment_info" }]
            ]
        }
    });
});

// ========== BULK COMMAND ==========
bot.onText(/\/bulk/, (msg) => {
    const chatId = msg.chat.id;
    
    bot.sendMessage(chatId,
        `📁 *BULK LOOKUP SERVICE*\n\n` +
        `For businesses needing multiple lookups:\n\n` +
        `• Upload CSV file with phone numbers\n` +
        `• We process in batches\n` +
        `• Volume discounts available\n\n` +
        `📞 Contact @Moneymakingmachine8888 for pricing`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: "📞 Contact for Bulk Pricing", url: "https://t.me/Moneymakingmachine8888" }
                ]]
            }
        }
    );
});

// ========== BALANCE COMMAND ==========
bot.onText(/\/balance/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!users[userId]) {
        users[userId] = { lookupsUsed: 0, balance: 5, lastActivity: Date.now() };
        analytics.totalUsers++;
    }
    
    users[userId].lastActivity = Date.now();
    
    const message = `💰 *YOUR ACCOUNT*\n\n` +
                   `*Automated Lookup Credits:* ${users[userId].balance}\n` +
                   `*Lookups Used:* ${users[userId].lookupsUsed}\n` +
                   `*Member Since:* ${new Date(users[userId].joined).toLocaleDateString()}\n\n` +
                   `*Pricing:*\n` +
                   `• Automated: $0.10 per lookup\n` +
                   `• Manual Research: $30 per project\n\n` +
                   `/payment to buy credits`;
    
    bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[
                { text: "💳 Buy Credits", callback_data: "buy_credits" }
            ]]
        }
    });
});

// ========== SHARE COMMAND ==========
bot.onText(/\/share/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `📱 *Share Our Service*\n\n` +
        `Help others discover professional phone lookups!\n\n` +
        `👉 Share link: https://t.me/No1PhoneSearchBot\n` +
        `📢 Hashtag: #PhoneLookup #CarrierCheck\n\n` +
        `💡 *Referral Bonus:*\n` +
        `Use /referral to get your referral link`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: "📱 Share Bot", url: "https://t.me/share/url?url=https://t.me/No1PhoneSearchBot&text=Check%20this%20professional%20phone%20lookup%20bot!" }
                ]]
            }
        }
    );
});

// ========== REFERRAL COMMAND ==========
bot.onText(/\/referral/, (msg) => {
    const userId = msg.from.id;
    const referralLink = `https://t.me/No1PhoneSearchBot?start=ref_${userId}`;
    
    bot.sendMessage(msg.chat.id,
        `👥 *Referral Program*\n\n` +
        `Share your referral link:\n\`${referralLink}\`\n\n` +
        `For every friend who signs up:\n` +
        `• You get 1 free lookup\n` +
        `• They get 1 free lookup\n\n` +
        `Share with friends and colleagues!`,
        { 
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: "📱 Share Referral Link", url: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=Check%20out%20this%20phone%20lookup%20bot!%20Use%20my%20referral%20link%20for%20free%20credits.` }
                ]]
            }
        }
    );
});

// ========== COMPLETE HELP COMMAND ==========
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    
    const helpMessage = `🆘 *COMPLETE HELP GUIDE*\n\n` +
    
    `📱 *BASIC COMMANDS:*\n` +
    `/start - Welcome message & services\n` +
    `/lookup [number] - Phone number lookup\n` +
    `/balance - Check your credits\n` +
    `/payment - Payment methods & pricing\n` +
    `/deepsearch - Manual research ($30)\n` +
    `/bulk - Bulk processing info\n` +
    `/share - Share bot with friends\n` +
    `/referral - Get referral link\n\n` +
    
    `🔍 *SERVICES:*\n` +
    `1. *Automated Lookup* ($0.10)\n` +
    `   • Carrier identification\n` +
    `   • Location validation\n` +
    `   • Line type detection\n\n` +
    
    `2. *Manual Deep Search* ($30)\n` +
    `   • Business background checks\n` +
    `   • Professional verification\n` +
    `   • Public records search\n\n` +
    
    `3. *Bulk Processing*\n` +
    `   • CSV file processing\n` +
    `   • Volume discounts\n\n` +
    
    `💳 *PAYMENT:*\n` +
    `• Contact @Moneymakingmachine8888 for payment details\n` +
    `• Available: Wise, USDT, PayNow\n\n` +
    
    `⚠️ *LIMITATIONS:*\n` +
    `• Automated lookup shows technical data only\n` +
    `• Names require manual research ($30)\n` +
    `• Some carriers may show as "MVNO"\n\n` +
    
    `📞 *SUPPORT:* @Moneymakingmachine8888\n` +
    `⏰ Response time: 1-24 hours`;
    
    bot.sendMessage(chatId, helpMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "🔍 Try Lookup", switch_inline_query_current_chat: "" },
                    { text: "💳 Payment Info", callback_data: "payment_info" }
                ],
                [
                    { text: "📞 Contact Support", url: "https://t.me/Moneymakingmachine8888" }
                ]
            ]
        }
    });
});

// ========== FILE UPLOAD HANDLER ==========
bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    
    // Check if it's a CSV file
    if (msg.document.mime_type === 'text/csv' || msg.document.file_name.endsWith('.csv')) {
        bot.sendMessage(chatId,
            `📄 CSV file received!\n\n` +
            `For bulk processing, please:\n` +
            `1. Contact @Moneymakingmachine8888\n` +
            `2. We'll provide a quote\n` +
            `3. Process your file\n\n` +
            `*Note:* We don't process files automatically.`,
            { 
                parse_mode: 'Markdown',
                reply_mmarkup: {
                    inline_keyboard: [[
                        { text: "📞 Contact for Bulk Processing", url: "https://t.me/Moneymakingmachine8888" }
                    ]]
                }
            }
        );
    }
});

// ========== ADMIN COMMANDS ==========
bot.onText(/\/admin (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const command = match[1];
    
    // Check if admin
    if (userId.toString() !== ADMIN_USER_ID && ADMIN_USER_ID !== 'YOUR_TELEGRAM_ID_HERE') {
        return bot.sendMessage(chatId, '❌ Unauthorized');
    }
    
    if (command === 'stats') {
        const statsMessage = `📊 *BOT STATISTICS*\n\n` +
                           `Total Lookups: ${analytics.totalLookups}\n` +
                           `Successful: ${analytics.successfulLookups}\n` +
                           `Failed: ${analytics.failedLookups}\n` +
                           `Total Users: ${analytics.totalUsers}\n` +
                           `Active Today: ${analytics.activeToday.size}\n\n` +
                           `Top Countries:\n${Object.entries(analytics.countries)
                               .sort((a,b) => b[1] - a[1])
                               .slice(0, 5)
                               .map(([country, count]) => `• ${country}: ${count}`)
                               .join('\n')}`;
        
        bot.sendMessage(chatId, statsMessage, { parse_mode: 'Markdown' });
    } else if (command.startsWith('addcredits ')) {
        const parts = command.split(' ');
        const targetUserId = parts[1];
        const credits = parseInt(parts[2]);
        
        if (!users[targetUserId]) {
            users[targetUserId] = { balance: 0, lookupsUsed: 0 };
        }
        
        users[targetUserId].balance += credits;
        bot.sendMessage(chatId, `✅ Added ${credits} credits to user ${targetUserId}`);
    }
});

// ========== CALLBACK HANDLERS ==========
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
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
            `*Contact @Moneymakingmachine8888 for payment details*`,
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
            { 
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: "📞 Contact for Deep Search", url: "https://t.me/Moneymakingmachine8888" }
                    ]]
                }
            }
        );
    } else if (data === 'payment_info') {
        bot.sendMessage(chatId,
            `💳 *Payment Information*\n\n` +
            `Contact @Moneymakingmachine8888 for:\n` +
            `• Payment instructions\n` +
            `• Account details\n` +
            `• Credit activation\n\n` +
            `*Available methods:*\n` +
            `• Wise Transfer\n` +
            `• USDT (TRC-20)\n` +
            `• PayNow Singapore`,
            { 
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: "📞 Contact for Payment", url: "https://t.me/Moneymakingmachine8888" }
                    ]]
                }
            }
        );
    } else if (data === 'check_balance') {
        if (!users[userId]) {
            users[userId] = { balance: 5, lookupsUsed: 0 };
        }
        bot.sendMessage(chatId, `💰 Your balance: ${users[userId].balance} credits`);
    } else if (data.startsWith('inline_lookup_')) {
        const phoneNumber = data.replace('inline_lookup_', '');
        bot.sendMessage(chatId, `Use command: /lookup ${phoneNumber}`);
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
    console.log('   3. Bulk processing');
    console.log('========================================');
    console.log('📊 Features:');
    console.log('   • Rate limiting');
    console.log('   • User analytics');
    console.log('   • Inline queries');
    console.log('   • Referral system');
    console.log('========================================');
    console.log('📞 Support: @Moneymakingmachine8888');
    console.log('========================================');
});

console.log('🚀 Professional Lookup Bot ready!');
