require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const express = require('express');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const app = express();
app.use(express.json());

const CATEGORY_ID = process.env.CATEGORY_ID;
const ROLE_IDS = process.env.ROLE_IDS.split(',').map(id => id.trim());
const GUILD_ID = process.env.GUILD_ID;

client.once('ready', () => {
    console.log(`✅ Bot listo como ${client.user.tag}`);
});

app.post('/report', async (req, res) => {
    const { username, userid, reason } = req.body;

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const category = await guild.channels.fetch(CATEGORY_ID);

        if (!category || category.type !== 4) { // 4 = Category
            console.error("❌ Categoría no válida");
            return res.sendStatus(400);
        }

        const safeName = `reporte-${username}`.toLowerCase().replace(/[^a-z0-9\-]/g, '') || `reporte-${Date.now()}`;

        const channel = await guild.channels.create({
            name: safeName,
            type: 0, // GUILD_TEXT
            parent: category.id,
            permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                ...ROLE_IDS.map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] })),
            ],
        });

        await channel.send({
            content: `🧾 **Nuevo reporte**\n👤 Usuario: **${username}** (ID: ${userid})\n📄 Motivo: ${reason}`
        });

        console.log(`✅ Canal creado: ${channel.name}`);
        res.sendStatus(200);

    } catch (err) {
        console.error("❌ Error al crear el canal:", err);
        res.sendStatus(500);
    }
});

client.login(process.env.DISCORD_TOKEN);
app.listen(process.env.PORT, () => console.log(`🌐 API escuchando en puerto ${process.env.PORT}`));
