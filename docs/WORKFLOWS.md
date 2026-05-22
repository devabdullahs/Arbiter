# Referee Workflows

Arbiter is organized around real event operations, not only command lists. These examples show how a
referee or admin can use it during live matches.

## Workflow 1: Guild-Installed BO3 Match

Use this when the bot is installed in the tournament server and the organizer allows channel/role
automation.

1. Admin configures the org:

   ```text
   /org setup auto_create:true
   /org member
   ```

2. Referee or admin creates the match:

   ```text
   /match-admin create team_a:Alliance team_b:Team Falcons best_of:3 player_scores:true
   ```

3. If the match needs team-only rooms, pass team roles during creation or use the panel's room flow.

4. Referee runs match setup from the Components V2 panel:

   - Start Veto
   - Start Match
   - Team Rooms
   - Report Score
   - Pause Log
   - Warn
   - Evidence
   - Ruling
   - Timeline
   - Close

5. Score proof, warnings, pauses, evidence, rulings, and notes are posted to the match-log or
   evidence-vault channel.

6. Closing the match archives room transcripts, updates the panel, and deletes temporary rooms.

## Workflow 2: Battle-Royale Lobby

Use this for Apex Legends, Fortnite, PUBG, PUBG Mobile, Free Fire, or any multi-team lobby with
placement and kill scoring.

1. Create the lobby:

   ```text
   /br create title:EWC 2024 Apex Legends Mock Finals game:Apex Legends planned_games:6 teams:Alliance,Team Falcons,...
   ```

2. The standings board becomes the BR control panel.

3. For each game, click **Log Game**. The modal is prefilled as:

   ```text
   Team Name placement kills
   ```

   The referee usually only edits the placement and kill numbers from the scoreboard screenshot.

4. Use BR-specific referee tools as needed:

   - **Adjust/Penalty:** add or deduct points/kills after review.
   - **Pause:** log technical, admin, tactical, emergency, or other pauses.
   - **Warn:** track team/player infractions.
   - **Evidence:** attach screenshots, clips, or URLs to the lobby.
   - **Note:** add handoff/context notes.
   - **Dispute:** flag a game or lobby as disputed.
   - **Team Rooms:** create team categories with text and voice rooms.
   - **Close:** finalize standings and clean up temporary team rooms.

5. Arbiter folds point adjustments into standings and reflects referee activity on the board.

## Workflow 3: User-Installed Referee Logging

Use this when the org will not add another bot to its server, but a referee still wants clean records.

1. Referee installs Arbiter to their own Discord account.

2. During an external event, the referee logs from any safe user-install context:

   ```text
   /log score teams:Alliance vs Team Falcons result:13-11 event:Community Cup
   /log warning subject:PlayerName event:Community Cup notes:Late check-in
   /log evidence event:Community Cup notes:Scoreboard screenshot
   /log list
   ```

3. Logs remain personal and retrievable without requiring server-management permissions.

This mode is intentionally limited. It is not a way to manage another server without permission.

## Workflow 4: Dispute And Evidence Review

Use this when players or coaches raise an issue during a live match.

1. Player or referee submits evidence from a match/team room or user-install context.

2. Arbiter mirrors evidence metadata and attachment references to the evidence-vault channel when the
   org has one configured.

3. Referee uses the match panel or `/ref-my evidence` to review evidence.

4. Referee logs the ruling:

   - warning
   - score correction
   - point adjustment
   - forfeit
   - DQ
   - no-show
   - admin loss
   - disputed/pending review

5. Arbiter keeps the match timeline and log channel as the source of truth for later admin review.

## Workflow 5: Referee Shift Handoff

Use this when one referee leaves and another takes over.

1. Current referee checks active work:

   ```text
   /ref dashboard
   ```

2. They add a structured handoff note:

   ```text
   /ref-my handoff
   ```

3. Arbiter posts the note to logs and can DM the next referee when selected.

Useful handoff details:

- Current map/game
- Score state
- Active disputes
- Pause budget status
- Warnings already issued
- Evidence waiting for review
- Any team/player behavior to monitor

