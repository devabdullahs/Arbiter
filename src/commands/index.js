import { checkinCommand } from './checkin.js';
import { callRefCommand } from './call-ref.js';
import { evidenceCommand } from './evidence.js';
import { logCommand } from './log.js';
import { matchAdminCommand, matchCommand } from './match.js';
import { orgCommand } from './org.js';
import { presetCommand } from './preset.js';
import { profileCommand } from './profile.js';
import { refCommand } from './ref.js';
import { refMyCommand } from './ref-my.js';
import { refShiftCommand } from './ref-shift.js';
import { refLogCommand } from './ref-log.js';
import { rosterCommand } from './roster.js';
import { ruleCommand } from './rule.js';
import { scoreCommand } from './score.js';
import { warnCommand } from './warn.js';

export const commands = [
  orgCommand,
  presetCommand,
  refCommand,
  refMyCommand,
  rosterCommand,
  ruleCommand,
  matchCommand,
  matchAdminCommand,
  scoreCommand,
  warnCommand,
  refLogCommand,
  profileCommand,
  checkinCommand,
  evidenceCommand,
  logCommand,
  callRefCommand,
  refShiftCommand,
];
