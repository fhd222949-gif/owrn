// --- سيرفر Express لإبقاء البوت شغال على Render ---
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is running perfectly!');
});

app.listen(PORT, () => {
    console.log(`Web server listening on port ${PORT}`);
});

// --- استدعاء مكتبات ديسكورد ---
const { 
    Client, 
    GatewayIntentBits, 
    PermissionsBitField, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder,
    ChannelType 
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildBans
    ]
});

// ⚙️ الثوابت والإعدادات
const TICKET_PANEL_CHANNEL_ID = '1537502850446266430'; // 📌 روم إرسال لوحة التكت
const LOG_CHANNEL_ID = '1537509669457756251';          // 📋 روم حفظ اللوقات والسجلات
const TICKET_CATEGORY_ID = '1537503466497249280';     // 📁 كتاجوري التذاكر
const ADMIN_ROLE_ID = '1537502540122431539';          // 👑 رتبة الإدارة

// قاعدة بيانات للتحذيرات وحفظ منشئي التذاكر
const warningsDB = new Map();
const ticketOwners = new Map(); // للحفاظ على صاحب التذكرة لإرسال التذكير

client.on('clientReady', () => {
    console.log(`✅ تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
});

// ==========================================
// 1. أمر إرسال لوحة التذاكر (setup-tickets)
// ==========================================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const args = message.content.trim().split(/ +/);
    const cmd = args[0].toLowerCase();

    if (cmd === 'setup-tickets' || cmd === 'تثبيت-التكت') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.channel.send('❌ هذا الأمر للمسؤولين فقط.');
        }

        const embed = new EmbedBuilder()
            .setTitle('🎫 نظام الدعم الفني والتذاكر')
            .setDescription('يرجى اختيار القسم المناسب لمشكلتك من القائمة المنسدلة أسفله لفتح تذكرة جديدة.')
            .setColor(0x0099FF);

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_ticket_type')
            .setPlaceholder('اختر نوع التذكرة من هنا...')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('دعم فني')
                    .setValue('tech_support')
                    .setDescription('للحصول على مساعدة فنية عامة')
                    .setEmoji('🛠️'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('شكوى')
                    .setValue('complaint')
                    .setDescription('تقديم شكوى على عضو أو إداري')
                    .setEmoji('⚠️'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('المتجر')
                    .setValue('store')
                    .setDescription('استفسارات الشراء والمتجر')
                    .setEmoji('💰')
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const panelChannel = message.guild.channels.cache.get(TICKET_PANEL_CHANNEL_ID);
        if (!panelChannel) {
            return message.channel.send('❌ لم يتم العثور على روم لوحة التكت!');
        }

        await panelChannel.send({ embeds: [embed], components: [row] });
        return message.channel.send(`✅ تم إرسال لوحة التكت بنجاح إلى الروم: ${panelChannel}`);
    }

    // ==========================================
    // 2. أمر إغلاق التكت النصي
    // ==========================================
    if (['اغلاق', 'إغلاق', 'close'].includes(cmd)) {
        if (!message.channel.name.startsWith('ticket-') && !['دعم-فني', 'شكوى', 'المتجر'].some(type => message.channel.name.startsWith(type))) {
            return message.channel.send('❌ هذا الأمر يعمل فقط داخل رومات التذاكر.');
        }
        await closeTicketChannel(message.channel, message.author, 'بدون سبب محدد');
        return;
    }

    // ==========================================
    // 3. أوامر قفل وفتح الروم
    // ==========================================
    if (['قفل', 'ق', 'c'].includes(cmd)) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        return message.channel.send
