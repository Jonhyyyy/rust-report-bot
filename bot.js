require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField, SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const app = express();
app.use(express.json());

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const CATEGORY_ID = process.env.CATEGORY_ID;
const ROLE_IDS = process.env.ROLE_IDS.split(',').map(id => id.trim());
const GUILD_ID = process.env.GUILD_ID;
const PORT = process.env.PORT || 3000;

const linkDataPath = './linkData.json';
if (!fs.existsSync(linkDataPath)) fs.writeFileSync(linkDataPath, '{}');
let linkData = JSON.parse(fs.readFileSync(linkDataPath, 'utf8'));

// ✅ Registrar comando /link en Discord
const commands = [
    new SlashCommandBuilder()
        .setName('link')
        .setDescription('Vincula tu cuenta de Rust con Discord')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('🔄 Registrando comando /link...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('✅ Comando /link registrado correctamente.');
    } catch (error) {
        console.error('❌ Error al registrar comando:', error);
    }
})();


// 🧩 Cuando un usuario use /link en Discord
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() || interaction.commandName !== 'link') return;

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    linkData[code] = { discord_id: interaction.user.id, linked: false };
    fs.writeFileSync(linkDataPath, JSON.stringify(linkData, null, 2));

    await interaction.reply({
        content: `🔗 Tu código de enlace es: **${code}**\n\nVe al juego y usa:\n\`/link-discord ${code}\``,
        ephemeral: true
    });
});

// 📩 Endpoint para vincular desde Rust
app.post('/link', (req, res) => {
    const { steamid, code } = req.body;
    if (!linkData[code]) return res.status(400).send('Código inválido o expirado.');

    linkData[code].steamid = steamid;
    linkData[code].linked = true;
    fs.writeFileSync(linkDataPath, JSON.stringify(linkData, null, 2));
    res.sendStatus(200);
    console.log(`✅ Jugador ${steamid} vinculado con Discord ${linkData[code].discord_id}`);
});

// 📩 Endpoint de reportes (actualizado para añadir al jugador)
app.post('/report', async (req, res) => {
    const { username, userid, reason } = req.body;
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const category = await guild.channels.fetch(CATEGORY_ID);

        // Busca si el jugador está vinculado
        const linkedUser = Object.values(linkData).find(d => d.steamid === userid);

        // Crea el canal privado
        const channel = await guild.channels.create({
            name: `reporte-${username}`.toLowerCase().replace(/[^a-z0-9\-]/g, ''),
            type: 0,
            parent: category,
            permissionOverwrites: [
                { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
                ...ROLE_IDS.map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel] })),
                ...(linkedUser ? [{ id: linkedUser.discord_id, allow: [PermissionsBitField.Flags.ViewChannel] }] : [])
            ],
        });

        await channel.send({
            content: `${ROLE_IDS.map(id => `<@&${id}>`).join(' ')}\nNuevo reporte de **${username}** (ID: ${userid}):\n${reason}`
        });

        res.sendStatus(200);
    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
});

const express = require('express');
const app = express();

// Healthcheck para Uptime Robot
app.get('/', (req, res) => res.send('Bot activo ✅'));

// Escucha en el puerto asignado por Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor web activo en puerto ${PORT}`));


client.once('clientReady', () => console.log(`✅ Bot listo como ${client.user.tag}`));
client.login(process.env.DISCORD_TOKEN);
app.listen(PORT, () => console.log(`🌐 API escuchando en puerto ${PORT}`));
