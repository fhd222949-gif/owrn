const { 
    Client, 
    GatewayIntentBits, 
    PermissionsBitField, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType 
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// ⚙️ إعدادات التكت
const TICKET_CATEGORY_ID = '1537503466497249280'; 
const ADMIN_ROLE_ID = '1537502540122431539';

// قاعدة بيانات للتحذيرات
const warningsDB = new Map();

client.on('ready', () => {
    console.log(`تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const args = message.content.trim().split(/ +/);
    const cmd = args[0];

    // --- أمر إرسال لوحة التكت القديم ---
    if (cmd === 'setup-ticket') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.channel.send('❌ هذا الأمر للمسؤولين فقط.');
        }

        const embed = new EmbedBuilder()
            .setTitle('🎫 الدعم الفني - التذاكر')
            .setDescription('لإنشاء تكت والتواصل مع الدعم الفني، اضغط على الزر أدناه.')
            .setColor(0x0099FF);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel('إنشاء تكت 📩')
                    .setStyle(ButtonStyle.Primary)
            );

        return message.channel.send({ embeds: [embed], components: [row] });
    }

    // --- أمر إغلاق التكت ---
    if (cmd === 'اغلاق' || cmd === 'إغلاق') {
        if (!message.channel.name.startsWith('ticket-')) {
            return message.channel.send('❌ هذا الأمر يعمل فقط داخل رومات التكت.');
        }

        message.channel.send('🔒 سيتم إغلاق التكت وحذف الروم بعد 5 ثوانٍ...');
        setTimeout(() => {
            message.channel.delete().catch(() => {});
        }, 5000);
        return;
    }

    // --- أمر إعطاء التايم أوت ---
    if (['تأكيم', 'تاكيم', 'تيم'].includes(cmd)) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.channel.send('❌ ليس لديك صلاحية إعطاء تايم أوت.');
        }
        const target = message.mentions.members.first();
        if (!target) return message.channel.send('⚠️ يرجى منشن العضو لإعطائه تايم أوت.');
        
        const minutes = parseInt(args[2]) || 10;
        await target.timeout(minutes * 60 * 1000);
        return message.channel.send(`🔇 تم إعطاء تايم أوت لـ ${target} لمدة ${minutes} دقيقة.`);
    }

    // --- أمر فك التايم أوت ---
    if (['سولف', 'تكلم'].includes(cmd)) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.channel.send('❌ ليس لديك صلاحية فك التايم أوت.');
        }
        const target = message.mentions.members.first();
        if (!target) return message.channel.send('⚠️ يرجى منشن العضو لفك التايم أوت.');
        
        await target.timeout(null);
        return message.channel.send(`🔊 تم فك التايم أوت عن ${target}.`);
    }

    // --- أمر التحذير ---
    if (cmd === 'تحذير') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.channel.send('❌ ليس لديك صلاحية التحذير.');
        }
        const target = message.mentions.members.first();
        if (!target) return message.channel.send('⚠️ يرجى منشن العضو للتحذير.');
        
        const reason = args.slice(2).join(' ') || 'بدون سبب';
        const userWarns = warningsDB.get(target.id) || [];
        userWarns.push(reason);
        warningsDB.set(target.id, userWarns);
        
        return message.channel.send(`⚠️ تم تحذير ${target}\nالسبب: **${reason}**\nإجمالي التحذيرات: **${userWarns.length}**`);
    }

    // --- أمر إزالة التحذير ---
    if (cmd === 'ازالة') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.channel.send('❌ ليس لديك الصلاحية.');
        }
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
        if (userWarns.length === 0) return message.channel.send(`ℹ️ ${target} ليس لديه أي تحذيرات.`);
        
        const embed = new EmbedBuilder()
            .setTitle(`قائمة تحذيرات ${target.user.username}`)
            .setDescription(userWarns.map((w, i) => `**${i + 1}.** ${w}`).join('\n'))
            .setColor(0xFFA500);
            
        return message.channel.send({ embeds: [embed] });
    }

    // --- أمر قفل الروم ---
    if (cmd === 'قفل') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return message.channel.send('❌ ليس لديك صلاحية إدارة الرومات لقفل هذا الروم.');
        }
        
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
            SendMessages: false
        });
        
        return message.channel.send('🔒 تم قفل هذا الروم بنجاح.');
    }

    // --- أمر فتح الروم ---
    if (cmd === 'فتح') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return message.channel.send('❌ ليس لديك صلاحية إدارة الرومات لفتح هذا الروم.');
        }
        
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
            SendMessages: null
        });
        
        return message.channel.send('🔓 تم فتح الروم بنجاح.');
    }
});

// --- معالجة الضغط على زر التكت ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'create_ticket') {
        const guild = interaction.guild;
        const member = interaction.member;

        const existingChannel = guild.channels.cache.find(
            c => c.name === `ticket-${member.user.username.toLowerCase()}`
        );

        if (existingChannel) {
            return interaction.reply({ 
                content: `❌ لديك تكت مفتوح بالفعل: ${existingChannel}`, 
                ephemeral: true 
            });
        }

        const permissionOverwrites = [
            {
                id: guild.roles.everyone.id,
                deny: [PermissionsBitField.Flags.ViewChannel]
            },
            {
                id: member.id,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory
                ]
            },
            {
                id: ADMIN_ROLE_ID,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory
                ]
            }
        ];

        const ticketChannel = await guild.channels.create({
            name: `ticket-${member.user.username}`,
            type: ChannelType.GuildText,
            parent: TICKET_CATEGORY_ID,
            permissionOverwrites: permissionOverwrites
        });

        await interaction.reply({ 
            content: `✅ تم إنشاء التكت بنجاح: ${ticketChannel}`, 
            ephemeral: true 
        });

        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`أهلاً بك في التكت الخاص بك! 👋`)
            .setDescription(`أهلاً ${member}، يرجى كتابة مشكلتك أو استفسارك هنا وسيقوم فريق الإدارة بالرد عليك قريباً.\n\nمن أجل إغلاق التكت، اكتب: **\`اغلاق\`**`)
            .setColor(0x00FF00);

        await ticketChannel.send({ embeds: [welcomeEmbed] });
    }
});

client.login(process.env.TOKEN);
