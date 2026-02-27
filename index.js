const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChannelType, 
  PermissionsBitField 
} = require("discord.js");
const fs = require("fs");
const OpenAI = require("openai");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY
});

// Default prefix
const defaultPrefix = ".";
let prefixes = {};
let activeAI = new Set();

// Load economy data
let economy = {};
const econFile = "./economy.json";
if (fs.existsSync(econFile)) {
  economy = JSON.parse(fs.readFileSync(econFile));
}

// Load prefixes per server
const prefixFile = "./prefixes.json";
if (fs.existsSync(prefixFile)) {
  prefixes = JSON.parse(fs.readFileSync(prefixFile));
}

// Save economy helper
function saveEconomy() {
  fs.writeFileSync(econFile, JSON.stringify(economy, null, 2));
}

// Save prefixes helper
function savePrefixes() {
  fs.writeFileSync(prefixFile, JSON.stringify(prefixes, null, 2));
}

// =====================
// Bot ready
// =====================
client.once("clientReady", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// =====================
// Message handler
// =====================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const guildId = message.guild?.id;
  const prefix = prefixes[guildId] || defaultPrefix;

  // AI inside ticket
  if (!message.content.startsWith(prefix)) {
    if (
      message.channel.name.startsWith("ticket-") &&
      activeAI.has(message.channel.id)
    ) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a helpful support assistant." },
            { role: "user", content: message.content }
          ]
        });
        return message.reply(response.choices[0].message.content);
      } catch (err) {
        console.log("OPENAI ERROR:", err.message);
        return message.reply("❌ Error contacting OpenAI.");
      }
    }
    return;
  }

  // Commands
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // =====================
  // HELP
  // =====================
  if (command === "help") {
    const embed = new EmbedBuilder()
      .setTitle("📜 Help - Commands List")
      .setColor("#2b2d31")
      .setDescription(`
**Ticket System**
.ticket-dashboard - Show dashboard  
.AI-Assistance - Start AI inside ticket  
.AI-Close - Stop AI  
.close - Close ticket  
.ticket-add @user - Add user to ticket  
.ticket-remove @user - Remove user from ticket

**Moderation**
.kick @user  
.ban @user  
.timeout @user <seconds>  
.nickname @user <name>  

**Economy**
.balance [@user]  
.daily - claim 1000 coins  
.add @user <amount>  
.remove @user <amount>  
.leaderboard  

**Utility**
.set-prefix <prefix> - Change server prefix
.ping - Bot latency
    `);
    return message.channel.send({ embeds: [embed] });
  }

  // =====================
  // TICKET DASHBOARD
  // =====================
  if (command === "ticket-dashboard") {
    const embed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setTitle("Developer’s Portal - Support Dashboard")
      .setDescription(
        "**Welcome to Developer’s Portal - “Where Questions find Answers”**\n" +
        "We specialize in all design fields with exceptional quality and service."
      )
      .setImage("https://cdn.discordapp.com/attachments/1476384013026328708/1476419585363279893/IMG_4057.png")
      .setFooter({ text: "Click a button below to open a ticket." });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("open_ticket")
        .setLabel("Open Ticket")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("report_ticket")
        .setLabel("Reporting / Appeal")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("purchase_ticket")
        .setLabel("Purchase")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("quick_ticket")
        .setLabel("Quick Assistance")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("management_ticket")
        .setLabel("Management")
        .setStyle(ButtonStyle.Secondary)
    );

    await message.channel.send({ embeds: [embed], components: [row] });
    await message.channel.send({
      embeds: [
        new EmbedBuilder().setImage("https://cdn.discordapp.com/attachments/1476384013026328708/1476419597442875553/IMG_4058.png")
      ]
    });
  }

  // =====================
  // AI Assistance
  // =====================
  if (command === "ai-assistance") {
    if (!message.channel.name.startsWith("ticket-")) return message.reply("❌ Must be in a ticket to start AI.");
    activeAI.add(message.channel.id);
    return message.reply("🤖 AI Assistance Activated. Start typing your question.");
  }

  if (command === "ai-close") {
    if (!message.channel.name.startsWith("ticket-")) return message.reply("❌ Not in a ticket.");
    activeAI.delete(message.channel.id);
    return message.reply("🛑 AI Assistance Stopped.");
  }

  // =====================
  // TICKET MANAGEMENT
  // =====================
  if (command === "ticket-add") {
    if (!message.channel.name.startsWith("ticket-")) return message.reply("❌ Not a ticket.");
    const user = message.mentions.members.first();
    if (!user) return message.reply("❌ Mention a user to add.");
    await message.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true });
    return message.reply(`✅ ${user.user.tag} added to ticket.`);
  }

  if (command === "ticket-remove") {
    if (!message.channel.name.startsWith("ticket-")) return message.reply("❌ Not a ticket.");
    const user = message.mentions.members.first();
    if (!user) return message.reply("❌ Mention a user to remove.");
    await message.channel.permissionOverwrites.delete(user.id);
    return message.reply(`✅ ${user.user.tag} removed from ticket.`);
  }

  if (command === "close") {
    if (!message.channel.name.startsWith("ticket-")) return message.reply("❌ Not a ticket.");
    await message.reply("🔒 Closing ticket in 3 seconds...");
    setTimeout(() => message.channel.delete().catch(() => {}), 3000);
  }

  // =====================
  // Moderation Commands
  // =====================
  const modPerms = ["KickMembers", "BanMembers", "ManageNicknames", "ModerateMembers"];
  if (command === "kick") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return message.reply("❌ Missing permission.");
    const user = message.mentions.members.first();
    if (!user) return message.reply("❌ Mention someone to kick.");
    await user.kick();
    return message.reply(`✅ Kicked ${user.user.tag}`);
  }

  if (command === "ban") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply("❌ Missing permission.");
    const user = message.mentions.members.first();
    if (!user) return message.reply("❌ Mention someone to ban.");
    await user.ban();
    return message.reply(`✅ Banned ${user.user.tag}`);
  }

  if (command === "timeout") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply("❌ Missing permission.");
    const user = message.mentions.members.first();
    const sec = parseInt(args[1]);
    if (!user || isNaN(sec)) return message.reply("❌ Usage: .timeout @user <seconds>");
    await user.timeout(sec * 1000);
    return message.reply(`✅ Timed out ${user.user.tag} for ${sec}s`);
  }

  if (command === "nickname") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageNicknames)) return message.reply("❌ Missing permission.");
    const user = message.mentions.members.first();
    const nick = args.slice(1).join(" ");
    if (!user || !nick) return message.reply("❌ Usage: .nickname @user <name>");
    await user.setNickname(nick);
    return message.reply(`✅ Changed nickname of ${user.user.tag} to ${nick}`);
  }

  // =====================
  // Economy
  // =====================
  if (!economy[message.author.id]) economy[message.author.id] = 0;

  if (command === "balance") {
    let user = message.mentions.members.first() || message.member;
    if (!economy[user.id]) economy[user.id] = 0;
    return message.reply(`💰 ${user.user.tag} has ${economy[user.id]} coins`);
  }

  if (command === "daily") {
    economy[message.author.id] += 1000;
    saveEconomy();
    return message.reply("💵 You claimed 1000 coins!");
  }

  if (command === "add") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply("❌ Admin only");
    const user = message.mentions.members.first();
    const amount = parseInt(args[1]);
    if (!user || isNaN(amount)) return message.reply("❌ Usage: .add @user <amount>");
    if (!economy[user.id]) economy[user.id] = 0;
    economy[user.id] += amount;
    saveEconomy();
    return message.reply(`✅ Added ${amount} coins to ${user.user.tag}`);
  }

  if (command === "remove") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply("❌ Admin only");
    const user = message.mentions.members.first();
    const amount = parseInt(args[1]);
    if (!user || isNaN(amount)) return message.reply("❌ Usage: .remove @user <amount>");
    if (!economy[user.id]) economy[user.id] = 0;
    economy[user.id] -= amount;
    saveEconomy();
    return message.reply(`✅ Removed ${amount} coins from ${user.user.tag}`);
  }

  if (command === "leaderboard") {
    const sorted = Object.entries(economy).sort((a,b) => b[1]-a[1]).slice(0,10);
    const desc = sorted.map(([id, bal], i) => `${i+1}. <@${id}> - ${bal} coins`).join("\n") || "No data yet";
    return message.reply({ embeds: [new EmbedBuilder().setTitle("💰 Leaderboard").setDescription(desc).setColor("#2b2d31")]});
  }

  // =====================
  // Utility
  // =====================
  if (command === "set-prefix") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply("❌ Admin only");
    const newPrefix = args[0];
    if (!newPrefix) return message.reply("❌ Provide a new prefix");
    prefixes[guildId] = newPrefix;
    savePrefixes();
    return message.reply(`✅ Prefix changed to \`${newPrefix}\``);
  }

  if (command === "ping") {
    return message.reply(`🏓 Pong! ${client.ws.ping}ms`);
  }

});

// =====================
// Button interactions
// =====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const buttonId = interaction.customId;
  let channelName = `ticket-${interaction.user.username}`;

  let perms = [
    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
  ];

  // Staff for management ticket
  if (buttonId === "management_ticket") {
    // Add staff roles if needed
  }

  let channel = await interaction.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    permissionOverwrites: perms
  });

  await channel.send({ embeds: [
    new EmbedBuilder()
      .setTitle("🎫 Support Ticket")
      .setDescription("Thank you for contacting support.\nPlease describe your issue and wait for a response.")
      .setColor("#2b2d31")
  ]});

  return interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
});

// =====================
// LOGIN
// =====================
client.login(process.env.BOT_TOKEN);
