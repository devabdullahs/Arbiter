import { SlashCommandBuilder } from 'discord.js';
import { isOrgAdmin, requireOrganization } from '../services/org-service.js';
import { deleteRule, searchRules, slugifyRuleKey, upsertRule } from '../services/rulebook-service.js';
import { guildOnly } from './install-contexts.js';

export const ruleCommand = {
  data: guildOnly(
    new SlashCommandBuilder()
      .setName('rule')
      .setDescription('Search and manage referee rulebook references.')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('search')
          .setDescription('Search the server rulebook.')
          .addStringOption((option) => option.setName('query').setDescription('Keyword, rule number, tag, or topic').setRequired(true).setMaxLength(120)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('add')
          .setDescription('Create or update a rulebook entry.')
          .addStringOption((option) => option.setName('title').setDescription('Rule title').setRequired(true).setMaxLength(120))
          .addStringOption((option) => option.setName('body').setDescription('Rule text or referee guidance').setRequired(true).setMaxLength(1500))
          .addStringOption((option) => option.setName('tags').setDescription('Comma-separated search tags').setRequired(false).setMaxLength(200)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('delete')
          .setDescription('Delete a rulebook entry.')
          .addStringOption((option) => option.setName('key').setDescription('Rule key from search results').setRequired(true).setMaxLength(60)),
      ),
  ),

  async execute(interaction) {
    const organization = await requireOrganization(interaction);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'search') {
      const rules = await searchRules(organization.id, interaction.options.getString('query', true));
      await interaction.reply({ content: formatRules(rules), ephemeral: true });
      return;
    }

    if (!(await isOrgAdmin(interaction, organization))) {
      await interaction.reply({ content: 'Only an org admin can edit rulebook entries.', ephemeral: true });
      return;
    }

    if (subcommand === 'add') {
      const title = interaction.options.getString('title', true);
      const rule = await upsertRule(
        organization.id,
        {
          key: slugifyRuleKey(title),
          title,
          body: interaction.options.getString('body', true),
          tags: interaction.options.getString('tags'),
        },
        interaction.user,
      );

      await interaction.reply({ content: `Saved rule **${rule.title}** as \`${rule.key}\`.`, ephemeral: true });
      return;
    }

    if (subcommand === 'delete') {
      const ok = await deleteRule(organization.id, interaction.options.getString('key', true));
      await interaction.reply({ content: ok ? 'Rule deleted.' : 'I could not find that rule key.', ephemeral: true });
    }
  },
};

function formatRules(rules) {
  if (rules.length === 0) {
    return 'No matching rules found.';
  }

  return rules
    .map((rule) => [`**${rule.title}** (\`${rule.key}\`)`, rule.body, rule.tags ? `Tags: ${rule.tags}` : null].filter(Boolean).join('\n'))
    .join('\n\n')
    .slice(0, 1900);
}
