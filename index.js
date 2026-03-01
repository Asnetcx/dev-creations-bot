// FULL MASTER BOT BUILD

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField,
  AttachmentBuilder
} = require("discord.js");

const fs = require("fs");
const OpenAI = require("openai");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

let prefix = ".";
let economy = {};
let activeAI = new Set();
let claimedTickets = new Map();
let ticketCount = 0;

const TRANSCRIPT_LOG_CHANNEL = "PUT_LOG_CHANNEL_ID";
const MEMBER_CHANNEL_ID = "PUT_MEMBER_CHANNEL_ID";
const BOOST_CHANNEL_ID = "PUT_BOOST_CHANNEL_ID";

if (fs.existsSync("./economy.json"))
  economy = JSON.parse(fs.readFileSync("./economy.json"));

function saveEconomy() {
  fs.writeFileSync("./economy.json", JSON.stringify(economy, null, 2));
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ================= MEMBER + BOOST AUTO UPDATE =================
async function updateStats(guild) {
  const memberChannel = guild.channels.cache.get(MEMBER_CHANNEL_ID);
  const boostChannel = guild.channels.cache.get(BOOST_CHANNEL_ID);

  if (memberChannel)
    memberChannel.setName(`Members: ${guild.memberCount}`).catch(()=>{});

  if (boostChannel)
    boostChannel.setName(`Boosts: ${guild.premiumSubscriptionCount}`).catch(()=>{});
}

client.on("guildMemberAdd", member => updateStats(member.guild));
client.on("guildMemberRemove", member => updateStats(member.guild));

// ================= COMMAND HANDLER =================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ===== ASSISTANCE =====
  if (command === "assistance") {
    return message.reply(`
.dashboard
.ai-assistance
.ai-close
.balance
.daily
.add
.remove
.leaderboard
.kick
.ban
.timeout
.nickname
.set-prefix
.ping
`);
  }

  // ===== DASHBOARD =====
  if (command === "dashboard") {

    const embed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setDescription(`
━━━━━━━━━━━━━━━━━━━━━━
**Developer Portal**
Where Questions Find Answers
━━━━━━━━━━━━━━━━━━━━━━
`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("support").setLabel("Support").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("report").setLabel("Reporting / Appeal").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("purchase").setLabel("Purchase").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("quick").setLabel("Quick Assistance").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("management").setLabel("Management").setStyle(ButtonStyle.Secondary)
    );

    return message.channel.send({ embeds: [embed], components: [row] });
  }

  // ===== AI TOGGLE =====
  if (command === "ai-assistance") {
    if (!message.channel.name.startsWith("ticket-"))
      return message.reply("Must be inside ticket.");
    activeAI.add(message.channel.id);
    return message.reply("AI Activated.");
  }

  if (command === "ai-close") {
    activeAI.delete(message.channel.id);
    return message.reply("AI Disabled.");
  }

  // ===== ECONOMY =====
  if (!economy[message.author.id])
    economy[message.author.id] = 0;

  if (command === "balance") {
    const user = message.mentions.members.first() || message.member;
    return message.reply(`${user.user.tag}: ${economy[user.id] || 0} coins`);
  }

  if (command === "daily") {
    economy[message.author.id] += 1000;
    saveEconomy();
    return message.reply("You received 1000 coins.");
  }

  if (command === "add") {
    const user = message.mentions.members.first();
    const amount = parseInt(args[1]);
    if (!user || !amount) return;
    economy[user.id] = (economy[user.id] || 0) + amount;
    saveEconomy();
    return message.reply("Added.");
  }

  if (command === "remove") {
    const user = message.mentions.members.first();
    const amount = parseInt(args[1]);
    if (!user || !amount) return;
    economy[user.id] -= amount;
    saveEconomy();
    return message.reply("Removed.");
  }

  if (command === "leaderboard") {
    const sorted = Object.entries(economy)
      .sort((a,b)=>b[1]-a[1])
      .slice(0,10)
      .map((x,i)=>`${i+1}. <@${x[0]}> - ${x[1]}`);
    return message.reply(sorted.join("\n"));
  }

  // ===== MODERATION =====
  if (command === "kick") {
    const user = message.mentions.members.first();
    if (user) await user.kick().catch(()=>{});
  }

  if (command === "ban") {
    const user = message.mentions.members.first();
    if (user) await user.ban().catch(()=>{});
  }

  if (command === "timeout") {
    const user = message.mentions.members.first();
    const sec = parseInt(args[1]);
    if (user && sec) await user.timeout(sec*1000).catch(()=>{});
  }

  if (command === "nickname") {
    const user = message.mentions.members.first();
    const nick = args.slice(1).join(" ");
    if (user && nick) await user.setNickname(nick).catch(()=>{});
  }

  if (command === "set-prefix") {
    prefix = args[0];
    return message.reply(`Prefix changed to ${prefix}`);
  }

  if (command === "ping") {
    return message.reply(`Pong: ${client.ws.ping}ms`);
  }
});

// ================= AI RESPONSE =================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (
    message.channel.name.startsWith("ticket-") &&
    activeAI.has(message.channel.id)
  ) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a professional support assistant." },
          { role: "user", content: message.content }
        ]
      });

      return message.reply(response.choices[0].message.content);
    } catch {
      return message.reply("OpenAI error.");
    }
  }
});

// ================= BUTTON SYSTEM =================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (["support","report","purchase","quick","management"].includes(interaction.customId)) {
    ticketCount++;

    const channel = await interaction.guild.channels.create({
      name: `ticket-${ticketCount}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("unclaim").setLabel("Unclaim").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger)
    );

    await channel.send({ content: "Support Ticket", components: [row] });

    return interaction.reply({ content: `Ticket created: ${channel}`, ephemeral: true });
  }

  if (interaction.customId === "claim") {
    claimedTickets.set(interaction.channel.id, interaction.user.id);
    return interaction.reply("Claimed.");
  }

  if (interaction.customId === "unclaim") {
    claimedTickets.delete(interaction.channel.id);
    return interaction.reply("Unclaimed.");
  }

  if (interaction.customId === "close") {
    const messages = await interaction.channel.messages.fetch({ limit: 100 });
    let html = `<html><body><h2>Transcript</h2>`;
    messages.reverse().forEach(msg => {
      html += `<p><b>${msg.author.tag}</b>: ${msg.content}</p>`;
    });
    html += `</body></html>`;

    const path = `transcript-${interaction.channel.id}.html`;
    fs.writeFileSync(path, html);

    const file = new AttachmentBuilder(path);

    const logChannel = interaction.guild.channels.cache.get(TRANSCRIPT_LOG_CHANNEL);
    if (logChannel) logChannel.send({ files: [file] });

    interaction.user.send({ files: [file] }).catch(()=>{});

    await interaction.reply("Closing...");
    setTimeout(()=>interaction.channel.delete().catch(()=>{}), 3000);
  }
});

client.login(process.env.TOKEN);
