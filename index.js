const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField
} = require("discord.js");

const OpenAI = require("openai");
const express = require("express");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const PREFIX = ".";
const openTickets = new Map();
const aiSessions = new Map();

// OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY
});

// Keep alive server (Railway)
const app = express();
app.get("/", (req, res) => res.send("Bot is alive"));
app.listen(process.env.PORT || 3000);

// Bot Ready
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ==========================
// MESSAGE HANDLER (Commands + AI)
// ==========================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // ================= COMMANDS =================
  if (message.content.startsWith(PREFIX)) {
    const command = message.content.slice(PREFIX.length).trim().toLowerCase();

    // Ticket dashboard
    if (command === "ticket-dashboard") {
      const embed = new EmbedBuilder()
        .setImage("https://cdn.discordapp.com/attachments/1476384013026328708/1476419585363279893/IMG_4057.png?ex=69a1b723&is=69a065a3&hm=b93227b4c3200172a7b7a810e1d9ceb213e6f33164ddbfa647c774c7efb61a60&")
        .setDescription("🎫 **Support Center**\n\nClick below to open a ticket.")
        .setThumbnail("https://cdn.discordapp.com/attachments/1476384013026328708/1476419597442875553/IMG_4058.png?ex=69a1b726&is=69a065a6&hm=b1469c1d4517aba15e0334abcde80f11823653a54ab58f4b47b63cf6817f0fee&");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("open_ticket")
          .setLabel("Open Ticket 🎟️")
          .setStyle(ButtonStyle.Primary)
      );

      return message.channel.send({ embeds: [embed], components: [row] });
    }

    // Stop AI
    if (command === "stop-intelligence") {
      aiSessions.delete(message.author.id);
      return message.reply("✅ AI session stopped.");
    }
  }

  // ================= AI INSIDE TICKETS =================
  if (!openTickets.has(message.channel.id)) return;

  const userId = message.author.id;

  if (!aiSessions.has(userId)) {
    aiSessions.set(userId, []);
  }

  const history = aiSessions.get(userId);
  history.push({ role: "user", content: message.content });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: history
    });

    const reply = response.choices[0].message.content;
    history.push({ role: "assistant", content: reply });

    message.reply(reply);
  } catch (err) {
    console.log(err);
    message.reply("❌ Error contacting AI.");
  }
});

// ==========================
// BUTTON HANDLER
// ==========================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "open_ticket") {
    const existing = [...openTickets.entries()].find(
      ([, id]) => id === interaction.channel.id
    );

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: 0,
      permissionOverwrites: [
        {
          id: interaction.guild.roles.everyone,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages
          ]
        }
      ]
    });

    openTickets.set(channel.id, interaction.user.id);

    const embed = new EmbedBuilder()
      .setImage("https://cdn.discordapp.com/attachments/1476384013026328708/1476419585363279893/IMG_4057.png?ex=69a1b723&is=69a065a3&hm=b93227b4c3200172a7b7a810e1d9ceb213e6f33164ddbfa647c774c7efb61a60&")
      .setDescription(
        "Thank you for contacting support.\nPlease describe your issue and wait for a response."
      )
      .setThumbnail("https://cdn.discordapp.com/attachments/1476384013026328708/1476419597442875553/IMG_4058.png?ex=69a1b726&is=69a065a6&hm=b1469c1d4517aba15e0334abcde80f11823653a54ab58f4b47b63cf6817f0fee&");

    await channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed] });

    interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
  }
});

// Login
client.login(process.env.BOT_TOKEN);
