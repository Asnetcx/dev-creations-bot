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

const OpenAI = require("openai");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY
});

const PREFIX = ".";
const activeAI = new Set();

client.once("clientReady", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // =============================
  // AI CHAT (Only inside tickets when active)
  // =============================
  if (!message.content.startsWith(PREFIX)) {
    if (
      message.channel.name.startsWith("ticket-") &&
      activeAI.has(message.channel.id)
    ) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are a professional support assistant for Developer’s Portal."
            },
            { role: "user", content: message.content }
          ]
        });

        await message.reply(response.choices[0].message.content);
      } catch (err) {
        console.log("OPENAI ERROR:", err.message);
        await message.reply("❌ Error contacting OpenAI.");
      }
    }
    return;
  }

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // =============================
  // TICKET DASHBOARD
  // =============================
  if (command === "ticket-dashboard") {

    const topEmbed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setImage("https://cdn.discordapp.com/attachments/1476384013026328708/1476419585363279893/IMG_4057.png")
      .setDescription(
        `**Welcome to Developer’s Portal - “Where Questions find Answers”**\n\n` +
        `We specialize in all design fields with exceptional quality and service.`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("open_ticket")
        .setLabel("Open Ticket")
        .setStyle(ButtonStyle.Primary)
    );

    const bottomEmbed = new EmbedBuilder()
      .setImage("https://cdn.discordapp.com/attachments/1476384013026328708/1476419597442875553/IMG_4058.png");

    await message.channel.send({ embeds: [topEmbed] });
    await message.channel.send({ components: [row] });
    await message.channel.send({ embeds: [bottomEmbed] });
  }

  // =============================
  // START AI (Inside Ticket Only)
  // =============================
  if (command === "ai-assistance") {
    if (!message.channel.name.startsWith("ticket-")) {
      return message.reply("❌ You must be inside a ticket to start AI.");
    }

    activeAI.add(message.channel.id);
    return message.reply("🤖 AI Assistance Activated. Ask your question.");
  }

  // =============================
  // STOP AI
  // =============================
  if (command === "ai-close") {
    if (!message.channel.name.startsWith("ticket-")) {
      return message.reply("❌ This is not a ticket channel.");
    }

    activeAI.delete(message.channel.id);
    return message.reply("🛑 AI Assistance Stopped.");
  }

  // =============================
  // CLOSE TICKET
  // =============================
  if (command === "close") {
    if (!message.channel.name.startsWith("ticket-")) {
      return message.reply("❌ This is not a ticket channel.");
    }

    await message.reply("🔒 Closing ticket in 3 seconds...");
    setTimeout(() => {
      message.channel.delete().catch(() => {});
    }, 3000);
  }
});

// =============================
// BUTTON INTERACTION
// =============================

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "open_ticket") {

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
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

    await channel.send(
      `Thank you for contacting support.\n` +
      `Please describe your issue and wait for a response.`
    );

    await interaction.reply({
      content: `✅ Ticket created: ${channel}`,
      ephemeral: true
    });
  }
});

// =============================
// LOGIN
// =============================

client.login(process.env.BOT_TOKEN);
