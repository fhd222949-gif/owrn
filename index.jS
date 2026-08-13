const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionsBitField 
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const warningsDB = new Map();

client.once('ready', () => {
    console.log(`تم تشغيل البوت بنجاح: ${client.user.tag}`);
});

// --- نظام الترحيب ---
client.on('guildMemberAdd', async (member) => {
    const welcomeChannel = member.guild.channels.cache.find(c => c.name === 'welcome');
    if (welcomeChannel) {
        const embed = new EmbedBuilder()
            .setTitle('🎉 عضو جديد انضم إلينا!')
            .setDescription(`أهلاً وسهلاً بك ${member} في السيرفر! 🥳\nنتمنى لك وقتاً ممتعاً ✨`)
            .setColor(0xFFD700)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

        welcomeChannel.send({ embeds: [embed] });
    }
});

// --- أزرار التكت ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const { guild, user, customId } = interaction;
    let categoryName = '';

    if (customId === 'tech_support') categoryName = 'دعم-فني';
    if (customId === 'complaint') categoryName = 'شكوى';
    if (customId === 'store') categoryName = 'متجر';

    if (!categoryName) return;

    const channelName = `ticket-${user.username}`.toLowerCase();
    const existingChannel = guild.channels.cache.find(c => c.name === channelName);

    if (existingChannel) {
        return interaction.reply({ content: `لديك تكت مفتوح بالفعل: ${existingChannel}`, ephemeral: true });
    }

    const ticketChannel = await guild.channels.create({
        name: channelName,
        permissionOverwrites: [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        ],
    });

    await interaction.reply({ content: `تم إنشاء التكت بنجاح: ${ticketChannel}`, ephemeral: true });

    const embed = new EmbedBuilder()
        .setTitle(`تكت ${categoryName}`)
        .setDescription(`مرحباً ${user}، يرجى كتابة تفاصيل طلبك وسيقوم الفريق بالرد عليك قريباً.\n\n🔒 **لقفل التكت اكتب:** \`قفل\`\n🗑️ **لمسح التكت اكتب:** \`مسح\``)
        .setColor(0x0099FF);

    await ticketChannel.send({ embeds: [embed] });

    const logChannel = guild.channels.cache.find(c => c.name === 'ticket-log');
    if (logChannel) {
        const logEmbed = new EmbedBuilder()
            .setTitle('📝 فتح تكت جديد')
            .addFields(
                { name: 'العضو:', value: `${user}`, inline: true },
                { name: 'النوع:', value: categoryName, inline: true },
                { name: 'الروم:', value: ticketChannel.name, inline: true }
            )
            .setColor(0x00FF00);
        logChannel.send({ embeds: [logEmbed] });
    }
});

// --- الأوامر العامة والقفل والمسح ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const content = message.content.trim();
    const args = content.split(/ +/);
    const cmd = args[0];

    if (message.channel.name.startsWith('ticket-')) {
        if (content === 'قفل') {
            await message.channel.permissionOverwrites.set([{ id: message.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }]);
            await message.channel.send('🔒 تم قفل التكت.');
            const logChannel = message.guild.channels.cache.find(c => c.name === 'ticket-log');
            if (logChannel) logChannel.send(`🔒 تم قفل التكت \`${message.channel.name}\` بواسطة ${message.author}`);
            return;
        }

        if (content === 'مسح') {
            await message.channel.send('🗑️ سيتم حذف التكت خلال 5 ثوانٍ...');
            const logChannel = message.guild.channels.cache.find(c => c.name === 'ticket-log');
            if (logChannel) logChannel.send(`🗑️ تم حذف التكت \`${message.channel.name}\` بواسطة ${message.author}`);
            setTimeout(() => message.channel.delete(), 5000);
            return;
        }
    }

    if (content === 'setup-ticket' && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        const embed = new EmbedBuilder()
            .setTitle('🎫 نظام التكتات والإنذارات')
            .setDescription('اختر القسم المناسب لفتح تكت وتواصل مع الإدارة:')
            .setColor(0x5865F2);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('tech_support').setLabel('الدعم الفني 🛠️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('complaint').setLabel('الشكوى ⛔️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('store').setLabel('المتجر 💵').setStyle(ButtonStyle.Success)
        );

        return message.channel.send({ embeds: [embed], components: [row] });
    }

    // --- أمر الحظر ---
    if (['بنعالي', 'برجلي', 'تف', 'حظر'].includes(cmd)) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.channel.send('❌ ليس لديك صلاحية الحظر.');
        const target = message.mentions.members.first();
        if (!target) return message.channel.send('⚠️ يرجى منشن العضو المراد حظره.');
        const reason = args.slice(2).join(' ') || 'لم يتم ذكر سبب';
        await target.ban({ reason });
        return message.channel.send(`🔨 تم حظر ${target.user.tag} بنجاح.`);
    }

    // --- أمر فك الحظر (جديد) ---
    if (['فك', 'رحمتك', 'سامح'].includes(cmd)) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.channel.send('❌ ليس لديك صلاحية فك الحظر.');
        const userId = args[1];
        if (!userId) return message.channel.send('⚠️ يرجى كتابة الـ ID الخاص بالعضو.');
        
        try {
            await message.guild.members.unban(userId);
            return message.channel.send(`✅ تم فك الحظر عن العضو صاحب الـ ID: **${userId}** بنجاح.`);
        } catch (error) {
            return message.channel.send('❌ تعذر فك الحظر، تأكد من صحة الـ ID وأن العضو محظور بالفعل.');
        }
    }

    // --- أمر التايم أوت ---
    if (['اص', 'اسكت'].includes(cmd)) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.channel.send('❌ ليس لديك صلاحية التايم أوت.');
        const target = message.mentions.members.first();
        const minutes = parseInt(args[2]);
        if (!target || isNaN(minutes)) return message.channel.send('⚠️ طريقة الاستخدام: `اص @العضو الوقت_بالدقائق`');
        await target.timeout(minutes * 60 * 1000, 'تايم أوت إداري');
        return message.channel.send(`🤫 تم إعطاء تايم أوت لـ ${target} لمدة ${minutes} دقيقة.`);
    }

    // --- أمر فك التايم أوت ---
    if (['سولف', 'تكلم'].includes(cmd)) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.channel.send('❌ ليس لديك صلاحية فك التايم أوت.');
        const target = message.mentions.members.first();
        if (!target) return message.channel.send('⚠️ يرجى منشن العضو لفك التايم أوت.');
        await target.timeout(null);
        return message.channel.send(`🔊 تم فك التايم أوت عن ${target}.`);
    }

    // --- أمر التحذير ---
    if (cmd === 'تحذير') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return message.channel.send('❌ ليس لديك صلاحية التحذير.');
        const target = message.mentions.members.first();
        if (!target) return message.channel.send('⚠️ يرجى منشن العضو للتحذير.');
        const reason = args.slice(2).join(' ') || 'بدون سبب';
        const userWarns = warningsDB.get(target.id) || [];
        userWarns.push(reason);
        warningsDB.set(target.id, userWarns);
        return message.channel.send(`⚠️ تم تحذير ${target}.\nالسبب: **${reason}**\nإجمالي التحذيرات: **${userWarns.length}**`);
    }

    // --- أمر إزالة التحذير ---
    if (cmd === 'ازالة') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return message.channel.send('❌ ليس لديك الصلاحية.');
        const target = message.mentions.members.first();
        if (!target) return message.channel.send('⚠️ يرجى منشن العضو.');
        const userWarns = warningsDB.get(target.id) || [];
        if (userWarns.length > 0) {
            userWarns.pop();
            warningsDB.set(target.id, userWarns);
            return message.channel.send(`✅ تم إزالة آخر تحذير عن ${target}. المتبقي: **${userWarns.length}**`);
        } else {
            return message.channel.send('⚠️ هذا العضو ليس لديه تحذيرات.');
        }
    }

    // --- أمر عرض التحذيرات ---
    if (cmd === 'القائمة') {
        const target = message.mentions.members.first() || message.member;
        const userWarns = warningsDB.get(target.id) || [];
        if (userWarns.length === 0) return message.channel.send(`📋 ${target} ليس لديه أي تحذيرات.`);
        const embed = new EmbedBuilder()
            .setTitle(`قائمة تحذيرات ${target.user.username}`)
            .setDescription(userWarns.map((w, i) => `**${i + 1}.** ${w}`).join('\n'))
            .setColor(0xFFA500);
        return message.channel.send({ embeds: [embed] });
    }
});

client.login(process.env.TOKEN);
