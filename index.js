const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  PermissionsBitField 
} = require("discord.js");
const express = require("express");
const OpenAI = require("openai");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const PREFIX = "."; // Command prefix
const openTickets = new Map(); // Tracks open tickets
const sessions = new Map(); // Tracks AI sessions

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY
});

// Web server for uptime
const app = express();
app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(process.env.PORT || 3000, () => console.log("Web server running"));

// Bot ready
client.on("ready", () => {
  console.log(`Bot Online as ${client.user.tag}`);
});

// ========================
// Command Handler
// ========================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const command = message.content.slice(PREFIX.length).trim().toLowerCase();

  // Ticket dashboard
  if (command === "ticket-dashboard") {
    try {
      const embed = new EmbedBuilder()
        .setImage("https://cdn.discordapp.com/attachments/1476384013026328708/1476419585363279893/IMG_4057.png?ex=69a10e63&is=699fbce3&hm=3fc1c8f104d96cf22ef09560689bba2f22bc5f30fe03478b49da5056484d92d9&") // <-- replace
        .setDescription("🎫 **Welcome to Support**\n\nClick a button below to open a ticket.")
        .setThumbnail("https://cdn.discordapp.com/attachments/1476384013026328708/1476419597442875553/IMG_4058.png?ex=69a10e66&is=699fbce6&hm=c8a8632a93d1198a71baf04dd7c66f7580c2f07b7c62d10095067c47903e50b3&"); // <-- replace

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("open_ticket")
          .setLabel("General Support 👋")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("appeal_ticket")
          .setLabel("Report / Appeal 🚨")
          .setStyle(ButtonStyle.Danger)
      );

      await message.channel.send({ embeds: [embed], components: [row] });
    } catch (err) {
      console.log(err);
      message.channel.send("❌ Failed to send dashboard.");
    }
  }

  // Stop AI session
  if (command === "stop-intelligence") {
    sessions.delete(message.author.id);
    message.reply("✅ AI session stopped.");
  }
});

// ========================
// Button Interaction Handler
// ========================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  const userId = interaction.user.id;

  // Open ticket
  if (interaction.customId === "open_ticket" || interaction.customId === "appeal_ticket") {
    if (openTickets.has(userId)) return interaction.reply({ content: "❌ You already have an open ticket.", ephemeral: true });

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: 0, // GUILD_TEXT
      permissionOverwrites: [
        { id: interaction.guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: userId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    openTickets.set(userId, channel.id);

    const embed = new EmbedBuilder()
      .setImage("https://cdn.discordapp.com/attachments/1476384013026328708/1476419585363279893/IMG_4057.png?ex=69a10e63&is=699fbce3&hm=3fc1c8f104d96cf22ef09560689bba2f22bc5f30fe03478b49da5056484d92d9&") // <-- replace
      .setDescription("Thank you for contacting support.\nPlease describe your issue and wait for a response.")
      .setThumbnail("https://cdn.discordapp.com/attachments/1476384013026328708/1476419597442875553/IMG_4058.png?ex=69a10e66&is=699fbce6&hm=c8a8632a93d1198a71baf04dd7c66f7580c2f07b7c62d10095067c47903e50b3&"); // <-- replace

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("unclaim").setLabel("Unclaim").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("request_close").setLabel("Request Close").setStyle(ButtonStyle.Danger)
    );

    channel.send({ content: `<@${userId}>`, embeds: [embed], components: [row] });
    interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
  }

  // Ticket buttons
  if (interaction.customId === "claim") interaction.reply(`✅ ${interaction.user} claimed this ticket.`);
  if (interaction.customId === "unclaim") interaction.reply("❌ Ticket unclaimed.");
  if (interaction.customId === "request_close") interaction.reply({ content: "Type the reason for closing this ticket.", ephemeral: true });
});

// ========================
// AI Chat inside tickets
// ========================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (![...openTickets.values()].includes(message.channel.id)) return;

  const userId = message.author.id;
  if (!sessions.has(userId)) sessions.set(userId, []);
  sessions.get(userId).push({ role: "user", content: message.content });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: sessions.get(userId)
    });

    const reply = response.choices[0].message.content;
    sessions.get(userId).push({ role: "assistant", content: reply });
    message.reply(reply);
  } catch (err) {
    console.log(err);
    message.reply("❌ Error contacting AI.");
  }
});

// ========================
// Log in bot
// ========================
client.login(process.env.BOT_TOKEN);
