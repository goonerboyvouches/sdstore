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
});

function isAdmin(interaction) {
  return interaction.member.permissions.has('Administrator');
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
});

client.login(process.env.DISCORD_TOKEN);