import TelegramBot from 'node-telegram-bot-api';
import Wallet from './src/wallet.js';
import 'dotenv/config';

const bot = new TelegramBot(process.env.TELEGRAM_API, { polling: true });
const chatID = process.env.TELEGRAM_CHAT_ID;

export const sendMessage = message => {
    bot.sendMessage(chatID, message);
}

bot.on('message', async msg => {
    const messageText = msg.text;
    if (messageText === '/wallet') {
        bot.sendMessage(chatID, await prepareResponse(), {parse_mode: 'HTML'});
      }
  });

const prepareResponse = async () => {
    let response = '<b>Token Balance:</b>\n';
        response += '<pre>';
        response += 'Name       Amount    Gain\n';
        response += '-------------------------\n';

        for (const token of Wallet.tokens) {
            const { amountOut } = await Wallet.getAmount(token.mint, token.amount, false);
            const gain = calculatePercentageDifference(token.cost, amountOut).toFixed(2);
            let gainSymbol = token.gain >= 0 ? '🟢' : '🔴'; // Yeşil daire kazanç için, kırmızı daire kayıp için
            response += `${token.name.padEnd(10)} ${token.amount.toString().padEnd(8)} ${gainSymbol} ${gain}\n`;
        }
        response += '</pre>';
        response += '\n<b>Total Balance:</b> ' + Wallet.balance;

        return response;
} 

const calculatePercentageDifference = (buyPrice, sellPrice) => ((sellPrice - buyPrice) / buyPrice) * 100;