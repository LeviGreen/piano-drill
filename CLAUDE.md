# Piano Drill

## Ticket tracking

The ticket files in `docs/` are the only task trackers (no GitHub Issues/Jira): [docs/initiative-1-tickets.md](docs/initiative-1-tickets.md) (the MVP, PD-xxx; complete) and [docs/initiative-2-tickets.md](docs/initiative-2-tickets.md) (refactoring for cleanliness and flexibility, RF-xxx; complete) and [docs/initiative-3-tickets.md](docs/initiative-3-tickets.md) (small improvements and bug fixes, IM-xxx; open: add new tickets there). They are maintained by both the user and Claude, and tickets may evolve along with the design ([docs/design.MD](docs/design.MD)).

When work on a ticket is finished, in the same change as the code:
- Set its **Status** line (Todo / In progress / Blocked / Deferred / Done).
- Tick the acceptance criteria that are actually met (`- [x]`); leave unmet ones unticked.
- Update the epic's `Progress: X/N tickets done` line.
- Cross out the ticket's row (`~~text~~` in every cell) in the "Status at a glance" table at the top of the file when it is Done.

If scope changes while working, edit the ticket in its initiative's file too. Don't start a ticket's work without it being requested.
