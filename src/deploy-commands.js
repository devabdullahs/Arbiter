import { REST, Routes } from 'discord.js';
import { commands } from './commands/index.js';
import { getConfig } from './config.js';

const config = getConfig();
const rest = new REST({ version: '10' }).setToken(config.token);
const body = commands.map((command) => command.data.toJSON());

await rest.put(Routes.applicationCommands(config.clientId), { body });
console.log(`Registered ${body.length} global commands with install contexts.`);

if (config.devGuildId) {
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.devGuildId), { body });
  console.log(`Registered ${body.length} dev guild commands for ${config.devGuildId}.`);
}
