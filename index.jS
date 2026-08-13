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

    // 5️⃣ أوامر إزالة التايم أوت (تكلم / سولف)
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

    // 6️⃣ أوامر الباند (بنعالي / برجلي / حظر / تف)
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

    // 7️⃣ أوامر إلغاء الباند (رحمتك / فك / سماح)
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

    // 8️⃣ أوامر التحذير (تحذير / w)
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

    // 9️⃣ أمر إزالة التحذير (شيل / ازاله)
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

    // 🔟 أمر عرض قائمة التحذيرات (#تحذيرات)
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
// معالجة التفاعلات (Interactions)
// ==========================================
client.on('interactionCreate', async (interaction) => {
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket_type') {
        const guild = interaction.guild;
        const member = interaction.member;
        const selectedValue = interaction.values[0];

        let ticketTitle = '';
        let embedColor = 0x0000FF;

        if (selectedValue === 'tech_support') {
            ticketTitle = 'دعم-فني';
            embedColor = 0x0000FF;
        } else if (selectedValue === 'complaint') {
            ticketTitle = 'شكوى';
            embedColor = 0xFF0000;
        } else if (selectedValue === 'store') {
            ticketTitle = 'المتجر';
            embedColor = 0xFFFF00;
        }

        const channelName = `${ticketTitle}-${member.user.username.toLowerCase()}`;
        const existingChannel = guild.channels.cache.find(c => c.name === channelName);

        if (existingChannel) {
            return interaction.reply({ content: `❌ لديك تكت مفتوح بالفعل: ${existingChannel}`, ephemeral: true });
        }

        const permissionOverwrites = [
            { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
            { id: ADMIN_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
        ];

        const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: TICKET_CATEGORY_ID,
            permissionOverwrites: permissionOverwrites
        });

        ticketOwners.set(ticketChannel.id, member.id);

        await interaction.reply({ content: `✅ تم إنشاء تذكرتك بنجاح: ${ticketChannel}`, ephemeral: true });

        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`أهلاً بك في قسم (${ticketTitle}) 👋`)
            .setDescription(`مرحباً ${member}، يرجى كتابة تفاصيل طلبك بالتفصيل وسيتم الرد عليك قريباً من قبل الإدارة.`)
            .setColor(embedColor);

        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('claim_ticket')
                .setLabel('استلام ✋')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('ticket_options_btn')
                .setLabel('خيارات التذكرة 🗃️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('إغلاق 🔒')
                .setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({ 
            content: `<@&${ADMIN_ROLE_ID}> | ${member}`, 
            embeds: [welcomeEmbed],
            components: [actionRow]
        });
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'close_ticket') {
            await interaction.reply({ content: '🔒 جاري إغلاق التكت وحفظ السجل...' });
            await closeTicketChannel(interaction.channel, interaction.user, 'إغلاق عادي');
        }

        if (interaction.customId === 'claim_ticket') {
            if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: '❌ هذا الزر مخصص لأعضاء الإدارة فقط.', ephemeral: true });
            }

            const claimEmbed = new EmbedBuilder()
                .setDescription(`✋ تم استلام هذه التذكرة بواسطة الإداري: ${interaction.user}`)
                .setColor(0x00FF00);

            const updatedRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('claim_ticket')
                    .setLabel('مستلمة ✅')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('ticket_options_btn')
                    .setLabel('خيارات التذكرة 🗃️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('إغلاق 🔒')
                    .setStyle(ButtonStyle.Danger)
            );

            await interaction.update({ components: [updatedRow] });
            await interaction.channel.send({ embeds: [claimEmbed] });
        }

        if (interaction.customId === 'ticket_options_btn') {
            const optionsMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_options_menu')
                .setPlaceholder('اختر خياراً للتذكرة...')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('إغلاق بسبب')
                        .setValue('close_with_reason')
                        .setDescription('إغلاق التذكرة مع توضيح السبب')
                        .setEmoji('🔒'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('إضافة شخص للتذكرة')
                        .setValue('add_user')
                        .setDescription('إضافة شخص إلى هذه التذكرة')
                        .setEmoji('👤'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('تذكير عبر الرسائل للعضو')
                        .setValue('remind_user')
                        .setDescription('إرسال تذكير عبر الخاص إلى مُنشئ التذكرة')
                        .setEmoji('✉️'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('طلب نسخة من التذكرة')
                        .setValue('request_transcript')
                        .setDescription('طلب نسخة نصية من محادثة التذكرة')
                        .setEmoji('📄')
                );

            const menuRow = new ActionRowBuilder().addComponents(optionsMenu);
            await interaction.reply({ content: '👇 اختر من القائمة التالية:', components: [menuRow], ephemeral: true });
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_options_menu') {
        const value = interaction.values[0];

        if (value === 'close_with_reason') {
            await interaction.reply({ content: '🔒 يرجى كتابة السبب في الشات الآن وإرساله (لديك 30 ثانية):' });
            
            const filter = m => m.author.id === interaction.user.id;
            const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

            collector.on('collect', async m => {
                const reason = m.content;
                await m.reply(`✅ تم تسجيل السبب: **${reason}**`);
                await closeTicketChannel(interaction.channel, interaction.user, reason);
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    interaction.followUp({ content: '⏱️ انتهى الوقت دون كتابة السبب.' });
                }
            });
        }

        if (value === 'add_user') {
            await interaction.reply({ content: '👤 يرجى منشن الشخص المراد إضافته في الشات الآن (لديك 30 ثانية):' });

            const filter = m => m.author.id === interaction.user.id;
            const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

            collector.on('collect', async m => {
                const targetUser = m.mentions.users.first();
                if (!targetUser) return m.reply('❌ لم تقم بمنشن أي شخص بشكل صحيح.');

                await interaction.channel.permissionOverwrites.edit(targetUser.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });

                await m.reply(`✅ تم إضافة العضو ${targetUser} إلى التذكرة بنجاح.`);
            });
        }

        if (value === 'remind_user') {
            const ownerId = ticketOwners.get(interaction.channel.id);
            if (!ownerId) {
                return interaction.reply({ content: '❌ تعذر العثور على منشئ هذه التذكرة.', ephemeral: true });
            }

            try {
                const owner = await interaction.guild.members.fetch(ownerId);
                await owner.send(`🔔 **تذكير:** لديك تذكرة مفتوحة ينتظر منك الإداريون الرد عليها في سيرفر **${interaction.guild.name}**!\nالروم: ${interaction.channel}`);
                await interaction.reply({ content: `✉️ تم إرسال تذكير في الخاص إلى <@${ownerId}> بنجاح.` });
            } catch (e) {
                await interaction.reply({ content: '❌ تعذر إرسال التذكير، ربما قام العضو بإغلاق الخاص (DMs).', ephemeral: true });
            }
        }

        if (value === 'request_transcript') {
            await interaction.reply({ content: '📄 جاري استخراج نسخة من التذكرة...' });

            const fetchedMessages = await interaction.channel.messages.fetch({ limit: 100 });
            const logContent = fetchedMessages.map(m => `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}`).reverse().join('\n');
            const buffer = Buffer.from(logContent, 'utf-8');

            await interaction.followUp({ 
                content: '✅ تفضل نسخة من محادثات التذكرة:', 
                files: [{ attachment: buffer, name: `${interaction.channel.name}-transcript.txt` }] 
            });
        }
    }
});

// دالة مساعدة لإغلاق التكت وإرسال اللوق
async function closeTicketChannel(channel, closedBy, reason = 'غير محدد') {
    channel.send(`🔒 سيتم إغلاق التكت وحذف الروم خلال 5 ثوانٍ...\nالسبب: **${reason}**`);

    setTimeout(async () => {
        try {
            const fetchedMessages = await channel.messages.fetch({ limit: 100 });
            const logContent = fetchedMessages.map(m => `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}`).reverse().join('\n');
            const buffer = Buffer.from(logContent, 'utf-8');

            const logChannel = channel.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📋 سجل إغلاق تذكرة (Log)')
                    .addFields(
                        { name: 'اسم الروم:', value: channel.name, inline: true },
                        { name: 'بواسطة:', value: `${closedBy}`, inline: true },
                        { name: 'السبب:', value: reason, inline: false }
                    )
                    .setColor(0xFF0000)
                    .setTimestamp();

                await logChannel.send({ 
                    embeds: [logEmbed], 
                    files: [{ attachment: buffer, name: `${channel.name}-log.txt` }] 
                }).catch(() => {});
            }

            ticketOwners.delete(channel.id);
            await channel.delete().catch(() => {});
        } catch (e) {
            console.error(e);
        }
    }, 5000);
}

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
