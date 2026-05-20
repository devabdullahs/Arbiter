import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { getConfig } from './config.js';
import { handleInteraction } from './interactions/router.js';
import { startReminderLoop } from './services/reminder-service.js';

const config = getConfig();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  startReminderLoop(readyClient);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    await handleInteraction(interaction);
  } catch (error) {
    console.error(error);

    const payload = {
      content: error.message || 'Something went wrong while handling that interaction.',
      ephemeral: true,
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => null);
    } else {
      await interaction.reply(payload).catch(() => null);
    }
  }
});

await client.login(config.token);
