# Game Master Mode

Game Master Mode is Kamiya's default presentation layer for Cerbanimo project work. It changes how Kamiya narrates and renders project state; it does not move business logic out of Cerbanimo.

## Controls

- `/game-master on|off`: switch between narrative and plain presentation.
- `/narrative light|standard|immersive`: choose narration intensity.
- `/genre <genre>`: set a preferred genre.
- `/avoid-theme <theme>`: add a theme to avoid.
- `/stats narrative|numeric|both`: choose how progress stats appear.
- `Game Master,`, `Game Master:`, or `/plain`: one-turn plain response override.

Plain override responses begin with `Out of character:`.

## Quest Commands

- `/quest <projectId>`: load Cerbanimo's canonical quest context.
- `/party <projectId>`: show party members and authorized invite controls.
- `/party invite <projectId>`: request a one-time project invite from Cerbanimo.
- `/calling <projectId>`: show the current actor's calling.
- `/calling <projectId> title="..." roleArchetype=builder`: update the current actor's calling.
- `/launch quest <projectId>`: preview a quest launch action.
- `/chronicle <projectId>`: show the project chronicle.

## Privacy

Kamiya may render a raw invite token once in the live response card, but saved chat history redacts `token` and `inviteUrl` metadata before sending chats back to Cerbanimo.

Game Master narration must not claim that work is completed, rewards are issued, dependencies are activated, or stories are published. Those effects are reserved for later Cerbanimo settlement packets.
