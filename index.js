const TelegramBot = require('node-telegram-bot-api');
const truecallerjs = require('truecallerjs');
const fs = require('fs');
require('dotenv').config();

// ========== CONFIGURATION ==========
const token = process.env.TG_THIS_BOT_TOKEN;
if (!token) {
  console.error('❌ ERROR: TG_THIS_BOT_TOKEN is required!');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: false });
const express = require('express');
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// ========== SIMPLE DATABASE (JSON FILE) ==========
const USERS_FILE = 'users.json';

// Load or create users database
let users = {};
try {
  if (fs.existsSync(USERS_FILE)) {
    users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  }
} catch (e) {
  console.log('Creating new users database...');
}

function saveUsers() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function getUser(chatId) {
  if (!users[chatId]) {
    users[chatId] = {
      searches: 0,
      totalCredits: 3, // 3 free searches
      paid: false,
      joinDate: new Date().toISOString()
    };
    saveUsers();
  }
  return users[chatId];
}

// ========== TRUECALLER SETUP ==========
// Pool of installation IDs (you need to add these)
const INSTALLATION_IDS = [
  // ADD YOUR IDs HERE after getting from Android emulator
  // Example: "a1k07--Vgdfyvv_rftf5uuudhuhnkljyvvtfftjuhbuijbhug"
];

// ========== WEBHOOK SETUP ==========
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ========== BOT COMMANDS ==========

// /start - Welcome with credit info
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const user = getUser(chatId);
  
  const welcomeText = `🔍 *Welcome to Phone Search Pro!*\n\n` +
    `*Your Credits:* ${user.searches}/${user.totalCredits} searches used\n\n` +
    `*Available Commands:*\n` +
    `🔍 /search NUMBER - Lookup phone number\n` +
    `💳 /topup - Add more credits\n` +
    `📊 /credits - Check your balance\n` +
    `ℹ️ /info - Bot information\n\n` +
    `*Free:* 3 searches\n` +
    `*Pro:* 50 searches = $4.99 USD\n` +
    `*Premium:* $10/search (detailed report)`;
    
  bot.sendMessage(chatId, welcomeText, { parse_mode: 'Markdown' });
});

// /info - Bot information
bot.onText(/\/info/, (msg) => {
  const chatId = msg.chat.id;
  const infoText = `🤖 *Phone Search Bot*\n\n` +
    `• 3 free searches for new users\n` +
    `• Basic lookup: Carrier, location\n` +
    `• Use /topup for more credits\n` +
    `• Premium search: $10 USD (PM me)\n` +
    `• Payments: PayPal, Wise, PayNow (SG)`;
    
  bot.sendMessage(chatId, infoText, { parse_mode: 'Markdown' });
});

// /credits - Check balance
bot.onText(/\/credits/, (msg) => {
  const chatId = msg.chat.id;
  const user = getUser(chatId);
  
  const creditText = `💰 *Your Credits*\n\n` +
    `• Used: ${user.searches} searches\n` +
    `• Total: ${user.totalCredits} searches\n` +
    `• Remaining: ${user.totalCredits - user.searches} searches\n` +
    `• Status: ${user.paid ? '✅ Paid User' : '🆓 Free Tier'}\n\n` +
    `Need more? Use /topup`;
    
  bot.sendMessage(chatId, creditText, { parse_mode: 'Markdown' });
});

// /search - MAIN SEARCH FUNCTION
bot.onText(/\/search (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const phoneNumber = match[1].trim();
  const user = getUser(chatId);
  
  // Check credits
  if (user.searches >= user.totalCredits) {
    return bot.sendMessage(chatId, 
      `❌ *Out of Credits*\n\n` +
      `You've used ${user.searches}/${user.totalCredits} searches.\n\n` +
      `💳 Use /topup to buy more credits\n` +
      `📊 Use /credits to check balance`,
      { parse_mode: 'Markdown' }
    );
  }
  
  // Check if we have installation IDs
  if (INSTALLATION_IDS.length === 0) {
    return bot.sendMessage(chatId,
      `⚠️ *Service Setup Required*\n\n` +
      `The bot needs installation IDs to work.\n` +
      `Please set them up first.`,
      { parse_mode: 'Markdown' }
    );
  }
  
  // Perform search
  bot.sendMessage(chatId, `🔍 Searching for ${phoneNumber}...`);
  user.searches++;
  saveUsers();
  
  try {
    // Get random installation ID
    const installationId = INSTALLATION_IDS[Math.floor(Math.random() * INSTALLATION_IDS.length)];
    
    const searchData = {
      number: phoneNumber,
      countryCode: "IN",
      installationId: installationId
    };
    
    // Uncomment when you have real IDs
    // const response = await truecallerjs.search(searchData);
    // const name = response.getName();
    // const carrier = response.getCarrier();
    
    // DEMO RESPONSE (remove when you have real IDs)
    const demoData = {
      getName: () => "John Smith",
      getCarrier: () => "Verizon Wireless",
      getAddresses: () => [{ city: "New York", country: "USA" }],
      getEmailId: () => "john.smith@example.com"
    };
    
    const resultText = `✅ *Search Result*\n\n` +
      `• *Number:* ${phoneNumber}\n` +
      `• *Name:* ${demoData.getName()}\n` +
      `• *Carrier:* ${demoData.getCarrier()}\n` +
      `• *Location:* ${demoData.getAddresses()[0]?.city || 'Unknown'}\n` +
      `• *Email:* ${demoData.getEmailId() || 'Not available'}\n\n` +
      `📊 *Your credits:* ${user.searches}/${user.totalCredits}\n` +
      `🔄 *Remaining:* ${user.totalCredits - user.searches} searches`;
      
    bot.sendMessage(chatId, resultText, { parse_mode: 'Markdown' });
    
  } catch (error) {
    bot.sendMessage(chatId,
      `❌ *Search Failed*\n\n` +
      `Error: ${error.message}\n` +
      `Please try again or contact support.`,
      { parse_mode: 'Markdown' }
    );
    // Refund the search credit
    user.searches--;
    saveUsers();
  }
});

// /topup - Payment instructions
bot.onText(/\/topup/, (msg) => {
  const chatId = msg.chat.id;
  
  const paymentText = `💳 *Top Up Credits*\n\n` +
    `*Package Options:*\n` +
    `1. *Basic:* 50 searches = $4.99 USD\n` +
    `2. *Pro:* 200 searches = $14.99 USD\n` +
    `3. *Premium:* 1 detailed search = $10 USD\n\n` +
    `*Payment Methods:*\n` +
    `• *PayPal:* Send to your@paypal.com\n` +
    `• *Wise:* Transfer to wise@email.com\n` +
    `• *PayNow (SG):* +65-XXXX-XXXX\n\n` +
    `*Instructions:*\n` +
    `1. Send payment with note: "${chatId}"\n` +
    `2. Forward receipt to @YourUsername\n` +
    `3. Credits added within 24 hours\n\n` +
    `*Your Telegram ID:* \`${chatId}\`\n` +
    `(Include this in payment note!)`;
    
  bot.sendMessage(chatId, paymentText, { parse_mode: 'Markdown' });
});

// /addcredits - ADMIN ONLY (for manual credit addition)
bot.onText(/^\/addcredits (\d+) (\d+)$/, (msg, match) => {
  const chatId = msg.chat.id;
  const targetUserId = match[1];
  const credits = parseInt(match[2]);
  
  // Replace with your actual Telegram ID for admin access
  const ADMIN_ID = "YOUR_TELEGRAM_ID_HERE";
  
  if (chatId.toString() !== ADMIN_ID) {
    return bot.sendMessage(chatId, "❌ Admin only command.");
  }
  
  if (users[targetUserId]) {
    users[targetUserId].totalCredits += credits;
    saveUsers();
    bot.sendMessage(chatId, `✅ Added ${credits} credits to user ${targetUserId}`);
    bot.sendMessage(targetUserId, `🎉 You received ${credits} search credits!`);
  } else {
    bot.sendMessage(chatId, `❌ User ${targetUserId} not found.`);
  }
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log(`✅ Bot server running on port ${PORT}`);
  console.log(`✅ Users database ready`);
  console.log(`✅ Payment system enabled`);
});
