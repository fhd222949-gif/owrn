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
const TICKET_CHANNEL_ID = '1537509669457756251'; // روم إرسال اللوحة
const TICKET_CATEGORY_ID = '1537503466497249280'; // كتاجوري التذاكر
const ADMIN_ROLE_ID = '1537502540122431539'; // رتبة الإدارة

// قاعدة بيانات وهمية للتحذيرات واللوق (تحفظ في الذاكرة)
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
                    .setDescription('للحصول على مساعدة فنية عامة')
                    .setEmoji('🛠️'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('شكوى')
                    .setValue('complaint')
                    .setDescription('تقديم تقديم شكوى على عضو أو إداري')
                    .setEmoji('⚠️'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('المتجر')
                    .setValue('store')
                    .setDescription('استفسارات الشراء والمتجر')
                    .setEmoji('💰')
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const channel = message.guild.channels.cache.get(TICKET_CHANNEL_ID) || message.channel;
        await channel.send({ embeds: [embed], components: [row] });
        return message.channel.send('✅ تم إرسال لوحة التكت بنجاح.');
    }

    // ==========================================
    // 2. أمر إغلاق التكت + إرسال Log
    // ==========================================
    if (['اغلاق', 'إغلاق', 'close'].includes(cmd)) {
        if (!message.channel.name.startsWith('ticket-')) {
            return message.channel.send('❌ هذا الأمر يعمل فقط داخل رومات التذاكر.');
        }

        message.channel.send('🔒 سيتم إغلاق التكت وحفظ اللوق وحذف الروم بعد 5 ثوانٍ...');

        setTimeout(async () => {
            // جلب الرسائل وعمل Log
            const fetchedMessages = await message.channel.messages.fetch({ limit: 100 });
            const logContent = fetchedMessages.map(m => `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}`).reverse().join('\n');
            const buffer = Buffer.from(logContent, 'utf-8');

            // إرسال اللوق لروم التكت الرئيسي قبل الحذف كـ Log
            const mainTicketChannel = message.guild.channels.cache.get(TICKET_CHANNEL_ID);
            if (mainTicketChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📋 سجل إغلاق تذكرة (Log)')
                    .addFields(
                        { name: 'اسم الروم:', value: message.channel.name, inline: true },
                        { name: 'بواسطة:', value: `${message.author}`, inline: true }
                    )
                    .setColor(0xFF0000)
                    .setTimestamp();

                await mainTicketChannel.send({ 
                    embeds: [logEmbed], 
                    files: [{ attachment: buffer, name: `${message.channel.name}-log.txt` }] 
                }).catch(() => {});
            }

            message.channel.delete().catch(() => {});
        }, 5000);
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

        const timeInput = args[1]; // مثل 10m أو 2h أو 1d
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
    // 6. أوامر الباند (بنعالي / برجلي / حظر / تف) بواسطة Reply أو Mention
    // ==========================================
    if (['بنعالي', 'برجلي', 'حظر', 'تف'].includes(cmd)) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return;

        let targetUser = message.mentions.users.first();
        if (!targetUser && message.reference) {
            const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
            targetUser = repliedMessage.author;
        }

        if (!targetUser) return message.channel.send('⚠️ يرجى عمل منشن للعضو أو الرد على رسالته لحظره.');

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
        if (!userId) return message.channel.send('⚠️ يرجى كتابة الـ ID الخاص بالعضو لفك الحظر. مثال: `فك 123456789`');

        try {
            await message.guild.members.unban(userId);
            return message.channel.send(`✅ تم فك الحظر عن المستخدم \`${userId}\` بنجاح.`);
        } catch (e) {
            return message.channel.send('❌ هذا المستخدم ليس محظوراً أو أن الـ ID غير صحيح.');
        }
    }

    // ==========================================
    // 8. أوامر التحذير (تحذير / w) بواسطة Reply
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
    // 9. أمر إزالة التحذير (شيل / ازاله) بواسطة Reply
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
// 11. معالجة القائمة المنسدلة وإنشاء التكت
// ==========================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;

    if (interaction.customId === 'select_ticket_type') {
        const guild = interaction.guild;
        const member = interaction.member;
        const selectedValue = interaction.values[0];

        // تحديد اللون والعنوان بناءً على الاختيار
        let ticketTitle = '';
        let embedColor = 0x000000;

        if (selectedValue === 'tech_support') {
            ticketTitle = 'دعم-فني';
            embedColor = 0x0000FF; // أزرق
        } else if (selectedValue === 'complaint') {
            ticketTitle = 'شكوى';
            embedColor = 0xFF0000; // أحمر
        } else if (selectedValue === 'store') {
            ticketTitle = 'المتجر';
            embedColor = 0xFFFF00; // أصفر
        }

        // التأكد من عدم وجود تكت مفتوح لنفس العضو بنفس النوع
        const channelName = `${ticketTitle}-${member.user.username.toLowerCase()}`;
        const existingChannel = guild.channels.cache.find(c => c.name === channelName);

        if (existingChannel) {
            return interaction.reply({ content: `❌ لديك تكت مفتوح بالفعل: ${existingChannel}`, ephemeral: true });
        }

        // صلاحيات الروم
        const permissionOverwrites = [
            { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
            { id: ADMIN_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
        ];

        // إنشاء روم التكت
        const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: TICKET_CATEGORY_ID,
            permissionOverwrites: permissionOverwrites
        });

        await interaction.reply({ content: `✅ تم إنشاء تذكرتك بنجاح: ${ticketChannel}`, ephemeral: true });

        // رسالة الترحيب والمنشن لرتبة الإدارة
        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`أهلاً بك في قسم (${ticketTitle}) 👋`)
            .setDescription(`مرحباً ${member}، يرجى كتابة تفاصيل طلبك بالتفصيل وسيتم الرد عليك قريباً من قبل الإدارة.\n\nمن أجل إغلاق التكت اكتب: **\`اغلاق\`**`)
            .setColor(embedColor);

        await ticketChannel.send({ 
            content: `<@&${ADMIN_ROLE_ID}> | ${member}`, 
            embeds: [welcomeEmbed] 
        });
    }
});

// دالة تحويل الوقت (m, h, d) إلى مللي ثانية
function parseDuration(str) {
    const regex = /^(\d+)([mhd])$/i;
    const match = str.match(regex);
    if (!match) return null;

    const num = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    if (unit === 'm') return num * 60 * 1000;
    if (unit === 'h') return num * 60 * 60 * 1000;
    if (unit === 'd') return num * 24 * 60 * 60 * 1000;

    return null;
}

client.login(process.env.TOKEN);
