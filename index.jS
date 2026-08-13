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
const TICKET_CHANNEL_ID = '1537502850446266430'; // روم إرسال لوحة التذاكر المحدث
const TICKET_CATEGORY_ID = '1537503466497249280'; // كتاجوري التذاكر
const ADMIN_ROLE_ID = '1537502540122431539'; // رتبة الإدارة

// قاعدة بيانات للتحذيرات (تحفظ في الذاكرة)
const warningsDB = new Map();

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

    // أمر إنشاء لوحة التاكت
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
                    .setDescription('لالحصول على مساعدة فنية عامة')
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

        // إرسال اللوحة دائماً للروم المخصص 1537502850446266430
        const targetChannel = message.guild.channels.cache.get(TICKET_CHANNEL_ID);
        if (!targetChannel) {
            return message.channel.send('❌ لم يتم العثور على روم التذاكر المحدد بالآيدي!');
        }

        await targetChannel.send({ embeds: [embed], components: [row] });
        return message.channel.send(`✅ تم إرسال لوحة التكت بنجاح إلى الروم: ${targetChannel}`);
    }

    // ==========================================
    // 2. أمر إغلاق التكت النصي
    // ==========================================
    if (['اغلاق', 'إغلاق', 'close'].includes(cmd)) {
        if (!message.channel.name.startsWith('ticket-')) {
            return message.channel.send('❌ هذا الأمر يعمل فقط داخل رومات التذاكر.');
        }
        await closeTicketChannel(message.channel, message.author);
        return;
    }

    // ==========================================
    // 3. أوامر قفل وفتح الروم
    // ==========================================
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

    // ==========================================
    // 4. أوامر التايم أوت (اسكت / اص / تايم) بواسطة Reply
    // ==========================================
    if (['اسكت', 'اص', 'تايم'].includes(cmd)) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
        
        if (!message.reference) {
            return message.channel.send('⚠️ يجب عليك عمل **Reply (رد)** على رسالة الشخص المراد إعطائه تايم أوت.');
        }

        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
        const target = repliedMessage.member;

        if (!target) return message.channel.send('❌ لم يتم العثور على العضو.');

        const timeInput = args[1]; 
        if (!timeInput) return message.channel.send('⚠️ يرجى تحديد المدة مثلاً: `10m` أو `2h` أو `1d`.');

        const durationMs = parseDuration(timeInput);
        if (!durationMs) return message.channel.send('❌ صيغة الوقت غير صحيحة! استخدم m (دقيقة)، h (ساعة)، d (يوم).');

        try {
            await target.timeout(durationMs);
            return message.channel.send(`🔇 تم إعطاء تايم أوت لـ ${target} لمدة **${timeInput}**.`);
        } catch (e) {
            return message.channel.send('❌ تعذر إعطاء التايم أوت، تأكد من صلاحيات البوت ورتبته.');
        }
    }

    // ==========================================
    // 5. أوامر إزالة التايم أوت (تكلم / سولف) بواسطة Reply
    // ==========================================
    if (['تكلم', 'سولف'].includes(cmd)) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;

        if (!message.reference) {
            return message.channel.send('⚠️ يجب عليك عمل **Reply (رد)** على رسالة الشخص لفك التايم أوت.');
        }

        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
        const target = repliedMessage.member;

        if (!target) return message.channel.send('❌ لم يتم العثور على العضو.');

        try {
            await target.timeout(null);
            return message.channel.send(`🔊 تم فك التايم أوت عن ${target}.`);
        } catch (e) {
            return message.channel.send('❌ حدث خطأ أثناء فك التايم أوت.');
        }
    }

    // ==========================================
    // 6. أوامر الباند (بنعالي / برجلي / حظر / تف)
    // ==========================================
    if (['بنعالي', 'برجلي', 'حظر', 'تف'].includes(cmd)) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return;

        let targetUser = message.mentions.users.first();
        if (!targetUser && message.reference) {
            const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
            targetUser = repliedMessage.author;
        }

        if (!targetUser) return message.channel.send('⚠️ يرجى عمل منشن للعضو أو الرد على رسالته لحظر.');

        try {
            await message.guild.members.ban(targetUser.id, { reason: `بواسطة ${message.author.tag}` });
            return message.channel.send(`🔨 تم إعطاء باند لـ **${targetUser.tag}** بنجاح.`);
        } catch (e) {
            return message.channel.send('❌ تعذر حظر العضو، حاول التأكد من الصلاحيات.');
        }
    }

    // ==========================================
    // 7. أوامر إلغاء الباند (رحمتك / فك / سماح)
    // ==========================================
    if (['رحمتك', 'فك', 'سماح'].includes(cmd)) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return;

        const userId = args[1];
        if (!userId) return message.channel.send('⚠️ يرجى كتابة الـ ID الخاص بالعضو لفك الحظر.');

        try {
            await message.guild.members.unban(userId);
            return message.channel.send(`✅ تم فك الحظر عن المستخدم \`${userId}\` بنجاح.`);
        } catch (e) {
            return message.channel.send('❌ هذا المستخدم ليس محظوراً أو أن الـ ID غير صحيح.');
        }
    }

    // ==========================================
    // 8. أوامر التحذير (تحذير / w)
    // ==========================================
    if (['تحذير', 'w'].includes(cmd)) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

        if (!message.reference) {
            return message.channel.send('⚠️ يجب عليك عمل **Reply (رد)** على رسالة الشخص لتحذيره.');
        }

        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
        const target = repliedMessage.author;

        const reason = args.slice(1).join(' ') || 'بدون سبب مذكور';
        const userWarns = warningsDB.get(target.id) || [];
        userWarns.push(reason);
        warningsDB.set(target.id, userWarns);

        return message.channel.send(`⚠️ تم إعطاء تحذير لـ <@${target.id}>\nالسبب: **${reason}**\nإجمالي التحذيرات: **${userWarns.length}**`);
    }

    // ==========================================
    // 9. أمر إزالة التحذير (شيل / ازاله)
    // ==========================================
    if (['شيل', 'ازاله', 'إزالة'].includes(cmd)) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

        if (!message.reference) {
            return message.channel.send('⚠️ يجب عليك عمل **Reply (رد)** على رسالة الشخص لإزالة التحذير.');
        }

        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
        const target = repliedMessage.author;

        const userWarns = warningsDB.get(target.id) || [];
        if (userWarns.length > 0) {
            userWarns.pop();
            warningsDB.set(target.id, userWarns);
            return message.channel.send(`✅ تم إزالة آخر تحذير عن <@${target.id}>. المتبقي: **${userWarns.length}**`);
        } else {
            return message.channel.send('ℹ️ هذا العضو ليس لديه أي تحذيرات.');
        }
    }

    // ==========================================
    // 10. أمر عرض قائمة التحذيرات (#تحذيرات)
    // ==========================================
    if (cmd === '#تحذيرات') {
        let target = message.mentions.users.first();
        if (!target && message.reference) {
            const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
            target = repliedMessage.author;
        }
        if (!target) target = message.author;

        const userWarns = warningsDB.get(target.id) || [];
        if (userWarns.length === 0) return message.channel.send(`ℹ️ العضو <@${target.id}> ليس لديه أي تحذيرات.`);

        const embed = new EmbedBuilder()
            .setTitle(`📜 قائمة تحذيرات ${target.username}`)
            .setDescription(userWarns.map((w, i) => `**${i + 1}.** ${w}`).join('\n'))
            .setColor(0xFFA500);

        return message.channel.send({ embeds: [embed] });
    }
});

// ==========================================
// 11. معالجة التفاعل مع القائمة والأزرار (Interactions)
// ==========================================
client.on('interactionCreate', async (interaction) => {
    // 1️⃣ اختيار قسم التكت من القائمة المنسدلة
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket_type') {
        const guild = interaction.guild;
        const member = interaction.member;
        const selectedValue = interaction.values[0];

        let ticketTitle = '';
        let embedColor = 0x000000;

        if (selectedValue === 'tech_support')
