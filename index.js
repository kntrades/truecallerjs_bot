const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Get token from environment variable
const token = process.env.TG_THIS_BOT_TOKEN || process.env.BOT_TOKEN;

if (!token) {
  console.error('ERROR: TG_THIS_BOT_TOKEN environment variable is required!');
  process.exit(1);
}

// Create bot
const bot = new TelegramBot(token, { polling: false });

// For webhook compatibility
const express = require('express');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Webhook endpoint
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Basic commands
bot.onText(/\/info/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '✅ Bot is working!\n\nCommands:\n/info - This message\n/login - Login to Truecaller (requires setup)\n/installation_id - Use existing token\n/logout - Logout');
});

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome to Truecaller Bot! Use /info for commands.');
});

bot.onText(/\/login/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '⚠️ Truecaller login requires additional setup. This is a basic bot template.');
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Bot server running on port ${PORT}`);
  console.log(`✅ Bot username: @${bot.options.username}`);
  console.log('✅ Use /info command in Telegram');
});

// Handle errors
bot.on('error', (error) => {
  console.error('Bot error:', error);
});
