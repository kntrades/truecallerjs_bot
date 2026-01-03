// Add this payment command handler
bot.onText(/\/payment/, (msg) => {
    const chatId = msg.chat.id;
    
    const paymentMessage = `<b>💰 PAYMENT OPTIONS - NO 1 PHONE SEARCH PROGRAM</b>

<b>📱 Product:</b> No 1 Phone Search Program
<b>🔍 Description:</b> Advanced phone lookup service with real-time data

<u>💰 PRICING PLANS (USD ONLY):</u>
• <b>Basic Plan:</b> $24.99 USD - 50 searches/month
• <b>Pro Plan:</b> $49.99 USD - Unlimited searches ✅ <i>Most Popular</i>
• <b>Business Plan:</b> $99.99 USD - All Pro features + API access

━━━━━━━━━━━━━━━━━━━━
<b>🅿️ PAYPAL PAYMENT</b>
<b>Link:</b> <code>https://www.paypal.com/ncp/payment/8RX8ZKB38B9HG</code>
<b>Action:</b> Click button below

━━━━━━━━━━━━━━━━━━━━
<b>🏦 WISE TRANSFER</b>
<b>Account Number:</b> <code>738120584057198</code>
<b>Currency:</b> USD Only

━━━━━━━━━━━━━━━━━━━━
<b>₿ USDT (TRC-20) CRYPTO</b>
<b>Wallet Address:</b> <code>TANsJR9v6RhpKKuLtU1HXhQf3YsFS7RNCU</code>
<b>Network:</b> TRC-20 Only

━━━━━━━━━━━━━━━━━━━━
<b>📱 PAYNOW (SINGAPORE ONLY)</b>
<b>UEN Number:</b> <code>202550900H</code>
<b>For:</b> Singapore residents only

━━━━━━━━━━━━━━━━━━━━
<b>📞 CONTACT AFTER PAYMENT</b>
<b>Telegram:</b> @Moneymakingmachine8888
<b>Send receipt after payment for activation!</b>

━━━━━━━━━━━━━━━━━━━━
<b>✅ SUMMARY:</b>
1. Choose your plan
2. Make payment in USD
3. Send receipt to @Moneymakingmachine8888
4. Receive access within 24 hours`;

    const options = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "💳 Pay with PayPal", url: "https://www.paypal.com/ncp/payment/8RX8ZKB38B9HG" }],
                [{ text: "📞 Contact Support", url: "https://t.me/Moneymakingmachine8888" }],
                [{ text: "✅ I've Paid", callback_data: "paid" }]
            ]
        }
    };

    bot.sendMessage(chatId, paymentMessage, options);
});

// Handle payment confirmation
bot.on('callback_query', (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;
    
    if (data === 'paid') {
        bot.answerCallbackQuery(callbackQuery.id, {
            text: "Please send your receipt to @Moneymakingmachine8888 for activation!"
        });
    }
});
