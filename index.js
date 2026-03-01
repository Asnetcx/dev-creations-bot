require("dotenv").config();
const { 
  Client, 
  GatewayIntentBits, 
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType
} = require("discord.js");

const OpenAI = require("openai");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

let ticketCount = 0;
const claimedTickets = new Map();

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});


// ================= DASHBOARD COMMAND =================
client.on("messageCreate", async (message) => {
  if (message.content === ".dashboard") {

    const embed = new EmbedBuilder()
      .setTitle("CARBON CUSTOMS DASHBOARD")
      .setDescription("Where Ideas Take Shape\n\nUse the buttons below for assistance.")
      .setColor("#2B6CB0");

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("support")
        .setLabel("Support")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("regulations")
        .setLabel("Regulations")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("designer")
        .setLabel("Designer Application")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("roblox")
        .setLabel("Roblox Group")
        .setStyle(ButtonStyle.Link)
        .setURL("https://roblox.com")
    );

    await message.channel.send({ embeds: [embed], components: [row1] });
  }
});


// ================= ASSISTANCE COMMAND =================
client.on("messageCreate", async (message) => {
  if (message.content === ".assistance") {

    const embed = new EmbedBuilder()
      .setTitle("Quick Assistance")
      .setDescription(`
.assistance - Shows this menu
.dashboard - Show main dashboard
.ai <question> - Ask AI anything
      `)
      .setColor("Blue");

    message.channel.send({ embeds: [embed] });
  }
});


// ================= AI COMMAND =================
client.on("messageCreate", async (message) => {
  if (!message.content.startsWith(".ai")) return;

  const question = message.content.replace(".ai", "").trim();
  if (!question) return message.reply("Ask something.");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: question }]
  });

  message.reply(response.choices[0].message.content);
});


// ================= BUTTON HANDLER =================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  // ===== SUPPORT BUTTON =====
  if (interaction.customId === "support") {
    ticketCount++;

    const channel = await interaction.guild.channels.create({
      name: `ticket-${ticketCount}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        }
      ]
    });

    const ticketEmbed = new EmbedBuilder()
      .setTitle("Support Ticket")
      .setDescription("Use buttons below to manage ticket.")
      .setColor("Green");

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("claim")
        .setLabel("Claim")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("unclaim")
        .setLabel("Unclaim")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("close")
        .setLabel("Close")
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId("appeal")
        .setLabel("Report / Appeal")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("purchase")
        .setLabel("Purchase")
        .setStyle(ButtonStyle.Success)
    );

    channel.send({ embeds: [ticketEmbed], components: [buttons] });

    interaction.reply({ content: `Ticket created: ${channel}`, ephemeral: true });
  }

  // ===== CLAIM =====
  if (interaction.customId === "claim") {
    claimedTickets.set(interaction.channel.id, interaction.user.id);
    interaction.reply(`Ticket claimed by ${interaction.user}`);
  }

  // ===== UNCLAIM =====
  if (interaction.customId === "unclaim") {
    claimedTickets.delete(interaction.channel.id);
    interaction.reply("Ticket unclaimed.");
  }

  // ===== CLOSE =====
  if (interaction.customId === "close") {

    const messages = await interaction.channel.messages.fetch({ limit: 100 });
    const transcript = messages.map(m => `${m.author.tag}: ${m.content}`).join("\n");

    await interaction.user.send(`Here is your transcript:\n\n${transcript}`);

    interaction.reply("Ticket closed.");
    setTimeout(() => interaction.channel.delete(), 3000);
  }

  // ===== REGULATIONS POPUP =====
  if (interaction.customId === "regulations") {
    interaction.reply({
      content: `
**Regulations**
1. Respect everyone
2. No stealing work
3. Use common sense
`,
      ephemeral: true
    });
  }

  // ===== DESIGNER APP =====
  if (interaction.customId === "designer") {
    interaction.reply({ content: "Designer application coming soon.", ephemeral: true });
  }

  // ===== APPEAL =====
  if (interaction.customId === "appeal") {
    interaction.reply({ content: "Appeal submitted. Staff will review.", ephemeral: true });
  }

  // ===== PURCHASE =====
  if (interaction.customId === "purchase") {
    interaction.reply({ content: "Purchase request sent to sales team.", ephemeral: true });
  }
});


client.login(process.env.TOKEN);
