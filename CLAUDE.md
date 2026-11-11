# Piano Drill

## Ticket tracking

[docs/tickets.md](docs/tickets.md) is the only task tracker (no GitHub Issues/Jira). It is maintained by both the user and Claude, and tickets may evolve along with the design ([docs/design.MD](docs/design.MD)).

When work on a ticket is finished, in the same change as the code:
- Set its **Status** line (Todo / In progress / Blocked / Done).
- Tick the acceptance criteria that are actually met (`- [x]`); leave unmet ones unticked.
- Update the epic's `Progress: X/N tickets done` line.
- Cross out the ticket's row (`~~text~~` in every cell) in the "Status at a glance" table at the top of the file when it is Done.

If scope changes while working, edit the ticket in `docs/tickets.md` too. Don't start a ticket's work without it being requested.
