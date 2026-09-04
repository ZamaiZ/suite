# Client Kickoff Design

## Goal

Track the client kickoff after the first briefing submission, with a dedicated contact timeline and a compact status on the client list.

## Decisions

- Kickoff belongs to `clients`; it never reuses `lead_activities` or `closing_stage`.
- Only admin, commercial manager, customer success, or the assigned closer can read or mutate it.
- The briefing must have `briefing_finalized_at` before contact can be used.
- `completed` is terminal. It cannot be reopened or rescheduled.
- `clients.stage` remains `initial`.

## Data model

`clients` gains `kickoff_stage` (`none`, `scheduled`, `no_show`, `completed`) and `kickoff_meeting_at`.

`client_activities` retains an append-only timeline for scheduled, rescheduled, no-show, completed, and note events. Scheduling events require channel and meeting time; notes require channel and text. A scheduled or no-show client has a meeting time, while none and completed do not.

## State transitions

- `none` → `scheduled`: schedule.
- `scheduled` → `scheduled`: reschedule.
- `scheduled` → `no_show`: record no-show.
- `scheduled` → `completed`: complete kickoff.
- `no_show` → `scheduled`: reschedule.
- `no_show` → `completed`: complete kickoff.
- Notes do not alter stage.
- `completed` allows no further events.

## UI

The existing client briefing dialog adds a left rail with Briefing and Contato. Contato is disabled until the briefing is finalized and is unavailable while staff editing is active. The contact panel loads on demand, exposes only valid actions for its stage, and owns its timeline.

The client list adds a kickoff badge and only shows a schedule mark while kickoff is scheduled.

## Security and errors

Every server action validates input, reloads the client, applies `denyUnlessCanManage`, and verifies briefing finalization and transition server-side. The UI renders action and loading errors locally without trusting client state.
