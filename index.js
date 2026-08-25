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

// Auto-deal scheduler - sends USDT/crypto deal embeds every 5-10 minutes randomly
function startAutoDeal() {
  const minInterval = 5 * 60 * 1000; // 5 minutes
  const maxInterval = 10 * 60 * 1000; // 10 minutes
  
  // Payment methods to randomly choose from
  const paymentMethods = ['usdt', 'cashapp', 'paypal', 'venmo', 'unidentified'];
  
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
    
    // Select random verified user or use Anonymous
    const verifiedIds = data.verifiedUsers ? Object.keys(data.verifiedUsers).filter(id => {
      const numericId = parseInt(id, 10);
      return !isNaN(numericId) && numericId > 0;
    }) : [];
    
    let selectedUser = null;
    if (verifiedIds && verifiedIds.length > 0) {
      selectedUser = verifiedIds[Math.floor(Math.random() * verifiedIds.length)];
    } else {
      selectedUser = '0'; // Use Anonymous
    }
    
    const user = client.users.cache.get(selectedUser);
    const sender = user ? user.tag : 'Anonymous';
    const receiver = 'Anonymous';
    
    // Random payment method and amount
    const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    const amount = (Math.random() * 100 + 10).toFixed(2); // $10-$110
    const txHash = '0xdbe0' + Math.floor(Math.random() * 999999).toString(16).padStart(6, '0');
    
    // Image URL (Discord default or random)
    const images = [
      'https://discord.com/assets Discord.IO_logo_292.png',
      'https://discord.com/assets misty_png.png',
      'https://discord.com/assets play_button_png.png'
    ];
    const image = images[Math.floor(Math.random() * images.length)];
    
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('💰 Deal Completed')
      .setDescription(`**Payment Method:** ${paymentMethod.toUpperCase()}`)
      .addFields(
        { name: 'Amount', value: `${amount} ${paymentMethod.toUpperCase()}` },
        { name: 'Sender', value: sender },
        { name: 'Receiver', value: receiver },
        { name: 'Transaction', value: txHash, inline: true }
      )
      .setThumbnail(image)
      .setTimestamp();
    
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
    
    const paymentArg = args[0] || 'usdt';
    const paymentMethod = paymentArg.toLowerCase();
    const amount = args[1] || '55.00';
    const sender = args[2] || 'Anonymous';
    const receiver = args[3] || 'Anonymous';
    const txHash = args[4] || '0xdbe0' + Math.floor(Math.random() * 999999).toString(16).padStart(6, '0');
    
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('💰 Deal Completed')
      .setDescription(`**Payment Method:** ${paymentMethod.toUpperCase()}`)
      .addFields(
        { name: 'Amount', value: `${amount} ${paymentMethod.toUpperCase()}` },
        { name: 'Sender', value: sender },
        { name: 'Receiver', value: receiver },
        { name: 'Transaction', value: txHash, inline: true }
      )
      .setTimestamp();
    
    if (data.vouchChannel) {
      const channel = message.client.channels.cache.get(data.vouchChannel);
      if (channel) {
        channel.send({ embeds: [embed] });
      }
    }
    
    message.reply(`✅ Deal embed sent to <#${data.vouchChannel}>`);
  }
});

client.login(process.env.DISCORD_TOKEN);