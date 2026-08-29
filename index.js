const { Client, GatewayIntentBits, Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

const DATA_PATH = path.join(__dirname, 'bot-data.json');

let data = {
  verifiedUsers: {},
  vouchChannel: null,
};

function loadData() {
  try {
    if (fs.existsSync(DATA_PATH)) {
      const raw = fs.readFileSync(DATA_PATH, 'utf8');
      data = JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load data:', e);
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

loadData();

client.once(Events.ClientReady, c => {
  console.log(`Logged in as ${c.user.tag}`);
  startAutoDeal();
});

function isAdmin(interaction) {
  return interaction.member.permissions.has('Administrator');
}

// Extensive payment methods array - includes ALL crypto and fiat
const paymentMethods = [
  // Crypto
  { name: 'bitcoin', symbol: '₿', isCrypto: true },
  { name: 'ethereum', symbol: 'Ξ', isCrypto: true },
  { name: 'litecoin', symbol: 'Ł', isCrypto: true },
  { name: 'bitcoin-cash', symbol: 'BCH', isCrypto: true },
  { name: 'ripple', symbol: 'XRP', isCrypto: true },
  { name: 'litecoin', symbol: 'LTC', isCrypto: true },
  { name: 'dogecoin', symbol: 'DOGE', isCrypto: true },
  { name: 'cardano', symbol: 'ADA', isCrypto: true },
  { name: 'solana', symbol: 'SOL', isCrypto: true },
  { name: 'doge', symbol: '˚ƒ', isCrypto: true },
  // Fiat/Fiat-like
  { name: 'usdt', symbol: '₿', isCrypto: true },
  { name: 'usdc', symbol: 'ⱃ', isCrypto: true },
  { name: 'cashapp', symbol: '$', isCrypto: false },
  { name: 'zelle', symbol: 'Z', isCrypto: false },
  { name: 'venmo', symbol: '🅥', isCrypto: false },
  { name: 'paypal', symbol: '💲', isCrypto: false },
  { name: 'wire-transfer', symbol: '↯', isCrypto: false },
  { name: 'gift-card', symbol: '🎁', isCrypto: false },
  { name: 'unidentified', symbol: '?', isCrypto: false }
];

// Auto-deal scheduler - sends deal embeds every 5-10 minutes randomly
function startAutoDeal() {
  const minInterval = 5 * 60 * 1000; // 5 minutes
  const maxInterval = 10 * 60 * 1000; // 10 minutes
  
  function sendAutoDeal() {
    if (!data.vouchChannel) {
      setTimeout(sendAutoDeal, Math.random() * (maxInterval - minInterval) + minInterval);
      return;
    }
    
    const channel = client.channels.cache.get(data.vouchChannel);
    if (!channel) {
      setTimeout(sendAutoDeal, Math.random() * (maxInterval - minInterval) + minInterval);
      return;
    }
    
    // Select random payment method
    const method = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    
    // Random amount in USD (range $1-$1000)
    const amount = (Math.random() * 999 + 1).toFixed(2);
    
    // Random sender/receiver from arrays
    const senders = [
      'Anonymous', 'User123', 'Customer456', 'Unknown', 'Buyer789',
      'Seller123', 'Client456', 'Member789', 'Partner001', 'Vendor999'
    ];
    const receivers = [
      'Anonymous', 'Receiver789', 'Business', 'Unknown', 'Customer123',
      'User456', 'Client789', 'Member001', 'Vendor999', 'Partner888'
    ];
    const sender = senders[Math.floor(Math.random() * senders.length)];
    const receiver = receivers[Math.floor(Math.random() * receivers.length)];
    
    // Random transaction hash
    const txHash = '0x' + Math.floor(Math.random() * 9999999999).toString(16).padStart(10, '0');
    
    // Determine if crypto and create appropriate embed
    const isCrypto = method.isCrypto;
    
    const embed = new EmbedBuilder()
      .setColor(isCrypto ? '#f7c6c7' : '#0099ff')
      .setTitle(`${method.name.toUpperCase()} Deal Complete`)
      .addFields(
        { name: 'Amount', value: `$${amount} (USD)`, inline: true },
        { name: 'Sender', value: sender, inline: true },
        { name: 'Receiver', value: receiver, inline: true }
      );
    
    // Add transaction hash for crypto methods
    if (isCrypto) {
      embed.addFields({ name: 'Transaction', value: txHash, inline: false });
      embed.setThumbnail(`https://cryptologos.cc/logos/${method.name}.png`);
    }
    
    // Add payment method symbol
    if (!isCrypto) {
      embed.addFields({ name: 'Payment Symbol', value: method.symbol, inline: true });
    }
    
    channel.send({ embeds: [embed] }).catch(console.error);
    
    // Schedule next auto-deal
    setTimeout(sendAutoDeal, Math.random() * (maxInterval - minInterval) + minInterval);
  }
  
  // Start with random initial delay
  setTimeout(sendAutoDeal, Math.random() * (maxInterval - minInterval) + minInterval);
}

// ===== SLASH COMMAND: /vouch =====

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'vouch') {
    const user = interaction.user;
    
    if (!data.verifiedUsers || !data.verifiedUsers[user.id]) {
      await interaction.reply({
        content: '❌ You haven\'t completed a deal yet. You can only vouch after an admin verifies your completed deal.',
        ephemeral: true,
      });
      return;
    }
    
    await interaction.reply({
      content: 'Enter your vouch message:',
      ephemeral: true,
    });
    const filter = i => i.user.id === user.id;
    const collector = interaction.channel.createMessageCollector({ filter, time: 60000 });
    
    collector.on('collect', async msg => {
      const vouchMessage = msg.content;
      
      if (data.vouchChannel) {
        const channel = interaction.client.channels.cache.get(data.vouchChannel);
        if (channel) {
          const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('💠 New Vouch')
            .setDescription(`**Vouched For:** @Anonymus`)
            .addFields(
              { name: 'Vouch', value: vouchMessage, inline: false },
              { name: 'Vouched By', value: 'Anonymous', inline: true },
              { name: 'Rating', value: '⭐⭐⭐⭐⭐', inline: true }
            )
            .setTimestamp();
          
          const row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('vouch_link')
                .setLabel('View Vouch')
                .setStyle(ButtonStyle.Link)
                .setURL('https://discord.gg')
            );
          
          channel.send({ embeds: [embed], components: [row] });
        }
      }
      
      await msg.reply('Vouch submitted successfully!');
      collector.stop();
    });
    
    collector.on('end', () => {
      collector.updater.stop();
    });
  }
});

// ===== BUTTON INTERACTION =====

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButtonInteraction()) return;

  if (interaction.customId === 'vouch_link') {
    await interaction.reply({
      content: 'You dont have access to this link',
      ephemeral: true,
    });
  }
});

// ===== ADMIN COMMAND HANDLING (PREFIX) =====

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  
  const content = message.content.trim();
  if (!content.startsWith('$')) return;
  
  const args = content.slice(1).split(/ +/);
  const cmd = args.shift().toLowerCase();
  
  if (cmd === 'set') {
    if (!isAdmin(message)) {
      return message.reply('❌ Only administrators can use this command.');
    }
    
    const userArg = args[0];
    if (!userArg) {
      return message.reply('Usage: $set <user>');
    }
    
    let userId;
    if (userArg.startsWith('<@') && userArg.endsWith('>')) {
      userId = userArg.replace('<@!', '').replace('<@', '').replace('>', '');
    } else {
      userId = userArg;
    }
    
    data.verifiedUsers = data.verifiedUsers || {};
    data.verifiedUsers[userId] = true;
    saveData();
    
    const user = message.guild.members.cache.get(userId) || { user: { tag: userId } };
    message.reply(`✅ ${user.user.tag} has been verified as completing a deal and can now submit a vouch.`);
  }
  
  if (cmd === 'unset') {
    if (!isAdmin(message)) {
      return message.reply('❌ Only administrators can use this command.');
    }
    
    const userArg = args[0];
    if (!userArg) {
      return message.reply('Usage: $unset <user>');
    }
    
    let userId;
    if (userArg.startsWith('<@') && userArg.endsWith('>')) {
      userId = userArg.replace('<@!', '').replace('<@', '').replace('>', '');
    } else {
      userId = userArg;
    }
    
    data.verifiedUsers = data.verifiedUsers || {};
    delete data.verifiedUsers[userId];
    saveData();
    
    const user = message.guild.members.cache.get(userId) || { user: { tag: userId } };
    message.reply(`✅ ${user.user.tag}'s verification has been removed.`);
  }
  
  if (cmd === 'setchannel') {
    if (!isAdmin(message)) {
      return message.reply('❌ Only administrators can use this command.');
    }
    
    const channelId = args[0];
    if (!channelId) {
      return message.reply('Usage: $setchannel <channel ID>');
    }
    
    data.vouchChannel = channelId;
    saveData();
    message.reply(`✅ Vouch channel set to <#${channelId}>`);
  }
  
  if (cmd === 'deal') {
    if (!isAdmin(message)) {
      return message.reply('❌ Only administrators can use this command.');
    }
    
    // Select random payment method
    const method = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    const amount = (Math.random() * 999 + 1).toFixed(2);
    
    const embed = new EmbedBuilder()
      .setColor(method.isCrypto ? '#f7c6c7' : '#0099ff')
      .setTitle(`${method.name.toUpperCase()} Deal Complete`)
      .addFields(
        { name: 'Amount', value: `$${amount} (USD)`, inline: true },
        { name: 'Sender', value: 'Anonymous', inline: true },
        { name: 'Receiver', value: 'Anonymous', inline: true }
      );
    
    // Add transaction hash for crypto methods
    if (method.isCrypto) {
      const txHash = '0x' + Math.floor(Math.random() * 9999999999).toString(16).padStart(10, '0');
      embed.addFields({ name: 'Transaction', value: txHash });
      embed.setThumbnail(`https://cryptologos.cc/logos/${method.name}.png`);
    }
    
    if (data.vouchChannel) {
      const channel = message.client.channels.cache.get(data.vouchChannel);
      if (channel) {
        channel.send({ embeds: [embed] });
      }
    }
    
    message.reply(`✅ ${method.name.toUpperCase()} deal embed sent to <#${data.vouchChannel}>`);
  }
});

client.login(process.env.DISCORD_TOKEN);