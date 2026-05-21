export const EvidenceStorageProvider = {
  DiscordVault: 'discord-vault',
  ExternalPending: 'external-pending',
};

export function getEvidenceStorageProvider() {
  return process.env.EVIDENCE_STORAGE_PROVIDER || EvidenceStorageProvider.DiscordVault;
}

export function isDiscordVaultProvider() {
  return getEvidenceStorageProvider() === EvidenceStorageProvider.DiscordVault;
}

export function canStoreEvidenceInCurrentProvider(match, { attachments = [], urls = [] } = {}) {
  if (!isDiscordVaultProvider()) {
    return false;
  }

  return Boolean(match.settings?.evidenceChannelId && (attachments.length > 0 || urls.length > 0));
}

export function describeEvidenceStorageProvider() {
  if (isDiscordVaultProvider()) {
    return 'Discord evidence vault';
  }

  return 'external storage provider pending implementation';
}
