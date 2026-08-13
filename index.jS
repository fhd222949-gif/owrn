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
const LOG_CHANNEL_ID = '1537509669457756251';      // 📋 روم حفظ اللوقات والسجلات
const TICKET_CATEGORY_ID = '1537503466497249280'; // 📁 كتاجوري التذاكر
const ADMIN_ROLE_ID = '1537502540122431539';      // 👑 رتبة الإدارة

// قاعدة بيانات للتحذيرات وحفظ منشئي التذاكر
const warningsDB = new Map();
const ticketOwners = new Map();

client.on('clientReady', () => {
    console.log(`✅ تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
});

// ==========================================
// أوامر البوت النصية
// ==========================================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const args = message.content.trim().split(/ +/);
    const cmd = args[0].toLowerCase();

    // 0️⃣ أمر عرض جميع الأوامر
    if (['الاوامر', 'أوامر', 'اوامر', 'help', 'الأوامر', '/الاوامر', '/اوامر'].includes(cmd)) {
        const helpEmbed = new EmbedBuilder()
            .setTitle('📜 قائمة جميع أوامر البوت')
            .setDescription('إليك جميع الأوامر المتاحة في البوت وكيفية استخدامها:')
            .setColor(0x0099FF)
            .addFields(
                { name: '🎫 أوامر التذاكر', value: '• `setup-tickets` أو `تثبيت-التكت` : لتثبيت لوحة التكت في الروم الحالية\n• `اغلاق` : لإغلاق التذكرة المفتوحة' },
                { name: '🔒 أوامر إدارة الرومات', value: '• `قفل` / `ق` : لقفل الروم الحالي\n• `فتح` / `ف` : لفتح الروم الحالي' },
                { name: '🔇 أوامر التايم أوت', value: '• `اسكت` / `اص` / `تايم <المدة>` : إعطاء تايم أوت (بالرد على الرسالة)\n• `تكلم` / `سولف` : فك التايم أوت (بالرد على الرسالة)' },
                { name: '🔨 أوامر الحظر (الباند)', value: '• `حظر` / `تف` / `بنعالي` / `برجلي` : حظر عضو (منشن أو بالرد)\n• `فك` / `سماح` / `رحمتك <ID>` : فك الحظر عن آيدي العضو' },
                { name: '⚠️ أوامر التحذيرات', value: '• `تحذير` / `w <السبب>` : تحذير عضو (بالرد على الرسالة)\n• `شيل` / `ازاله` : إزالة آخر تحذير (بالرد على الرسالة)\n• `#تحذيرات` : عرض قائمة تحذيرات العضو' }
            )
            .setFooter({ text: 'البوت في خدمتكم دائماً' })
            .setTimestamp();

        return message.channel.send({ embeds: [helpEmbed] });
    }

    // 1️⃣ أمر إرسال لوحة التذاكر (setup-tickets) في أي روم تختاره
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

        // إرسال اللوحة في نفس الروم الذي كُتب فيه الأمر
        await message.channel.send({ embeds: [embed], components: [row] });
        return message.channel.send('✅ تم إرسال لوحة التكت بنجاح في هذا الروم.');
    }

    // 2️⃣ أمر إغلاق التكت النصي
    if (['اغلاق', 'إغلاق', 'close'].includes(cmd)) {
        if (!message.channel.name.startsWith('ticket-') && !['دعم-فني', 'شكوى', 'المتجر'].some(type => message.channel.name.startsWith(type))) {
            return message.channel.send('❌ هذا الأمر يعمل فقط داخل رومات التذاكر.');
        }
        await closeTicketChannel(message.channel, message.author, 'بدون سبب محدد');
        return;
    }

    // 3️⃣ أوامر قفل وفتح الروم
    if (['قفل', 'ق', 'c'].includes(cmd)) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        return message.channel.send('🔒 تم قفل الروم بنجاح.');
    }

    if (['فتح', 'ف'].includes(cmd)) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
        return message.channel.send('🔓 تم فتح الروم بنجاح.');
    }

    // 4️⃣ أوامر التايم أوت (اسكت / اص / تايم)
    if (['اسكت', 'اص', 'تايم'].includes(cmd)) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
        
        if (!message.reference) {
            return message.channel.send('⚠️ يجب عليك عمل **Reply (رد)** على رسالة الشخص المراد إعطائه تايم أوت.');
        }

        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
        const target = repliedMessage.member;

        if (!target) return message.channel.send('❌ لم يتم العثور على العضو.');

        const timeInput = args[1]; 
        if (!timeInput) return
