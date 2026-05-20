import { SlashCommandBuilder } from 'discord.js';
import { isBuiltInPreset } from '../constants.js';
import { isOrgAdmin, requireOrganization, resolveOrganizationByGuild } from '../services/org-service.js';
import {
  deletePreset,
  getPreset,
  listPresets,
  parsePresetMapPool,
  slugifyPresetKey,
  upsertPreset,
} from '../services/preset-service.js';
import { guildOnly } from './install-contexts.js';

const VETO_CHOICES = [
  { name: 'Single final map ban (ban down to one)', value: 'final_map_ban' },
  { name: 'Series map picks', value: 'series_picks' },
  { name: 'Manual picks', value: 'manual_picks' },
];

export const presetCommand = {
  data: guildOnly(
    new SlashCommandBuilder()
      .setName('preset')
      .setDescription('Create and manage custom rules presets for this server.')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('create')
          .setDescription('Create or update a custom rules preset (map pool + veto format).')
          .addStringOption((option) =>
            option.setName('name').setDescription('Preset name, e.g. "Spring Cup"').setRequired(true).setMaxLength(60),
          )
          .addStringOption((option) =>
            option
              .setName('map_pool')
              .setDescription('Comma-separated map list, e.g. "Ascent, Bind, Haven, Lotus, Split"')
              .setRequired(true)
              .setMaxLength(1500),
          )
          .addStringOption((option) =>
            option
              .setName('veto_format')
              .setDescription('How maps are selected (default: single final map ban)')
              .setRequired(false)
              .addChoices(...VETO_CHOICES),
          )
          .addStringOption((option) =>
            option.setName('notes').setDescription('Optional notes shown to referees during veto').setRequired(false).setMaxLength(500),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand.setName('list').setDescription('List the custom presets saved for this server.'),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('delete')
          .setDescription('Delete a custom preset.')
          .addStringOption((option) =>
            option.setName('name').setDescription('Preset to delete').setRequired(true).setAutocomplete(true),
          ),
      ),
  ),

  async autocomplete(interaction) {
    try {
      const focused = interaction.options.getFocused(true);

      if (focused.name !== 'name' || !interaction.guildId) {
        await interaction.respond([]);
        return;
      }

      const organization = await resolveOrganizationByGuild(interaction.guild);

      if (!organization) {
        await interaction.respond([]);
        return;
      }

      const query = focused.value.toLowerCase();
      const presets = await listPresets(organization.id);
      const options = presets
        .filter((preset) => preset.label.toLowerCase().includes(query) || preset.key.includes(query))
        .slice(0, 25)
        .map((preset) => ({ name: preset.label, value: preset.key }));

      await interaction.respond(options);
    } catch {
      await interaction.respond([]).catch(() => null);
    }
  },

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const organization = await requireOrganization(interaction);

    if (subcommand === 'list') {
      const presets = await listPresets(organization.id);

      if (presets.length === 0) {
        await interaction.reply({ content: 'No custom presets yet. Create one with `/preset create`.', ephemeral: true });
        return;
      }

      const lines = presets.map(
        (preset) =>
          `\`${preset.key}\` **${preset.label}** — ${preset.vetoMode} — maps: ${preset.mapPool.join(', ')}${
            preset.notes ? `\n  ↳ ${preset.notes}` : ''
          }`,
      );
      await interaction.reply({ content: lines.join('\n').slice(0, 1900), ephemeral: true });
      return;
    }

    if (!(await isOrgAdmin(interaction, organization))) {
      await interaction.reply({ content: 'Only an org admin can create or delete presets.', ephemeral: true });
      return;
    }

    if (subcommand === 'create') {
      const name = interaction.options.getString('name', true);
      const key = slugifyPresetKey(name);

      if (!key) {
        await interaction.reply({ content: 'Preset name must contain at least one letter or number.', ephemeral: true });
        return;
      }

      if (isBuiltInPreset(key)) {
        await interaction.reply({ content: `\`${key}\` is a built-in preset name. Pick a different name.`, ephemeral: true });
        return;
      }

      const mapPool = parsePresetMapPool(interaction.options.getString('map_pool', true));

      if (mapPool.length < 2) {
        await interaction.reply({ content: 'Add at least two maps, comma-separated.', ephemeral: true });
        return;
      }

      const vetoMode = interaction.options.getString('veto_format') ?? 'final_map_ban';
      const notes = interaction.options.getString('notes') ?? null;
      const preset = await upsertPreset(organization.id, { label: name, mapPool, vetoMode, notes }, interaction.user);

      await interaction.reply({
        content: [
          `Saved preset **${preset.label}** (\`${preset.key}\`).`,
          `Veto: ${preset.vetoMode}`,
          `Maps: ${mapPool.join(', ')}`,
          'Pick it in `/match create` under the `rules_preset` option.',
        ].join('\n'),
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'delete') {
      const value = interaction.options.getString('name', true);
      const existing = (await getPreset(organization.id, value)) ?? (await getPreset(organization.id, slugifyPresetKey(value)));

      if (!existing) {
        await interaction.reply({ content: `No custom preset matching \`${value}\`.`, ephemeral: true });
        return;
      }

      await deletePreset(organization.id, existing.key);
      await interaction.reply({ content: `Deleted preset **${existing.label}** (\`${existing.key}\`).`, ephemeral: true });
    }
  },
};
