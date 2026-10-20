# Colours that mean something

Every colour on the boards carries a meaning. Before adding one, check it is
not already taken, and never give a second meaning to a colour below. Where a
colour appears twice (two greens), each has its own mark so they never read as
one thing from across a room.

| Colour | Value | Mark | Means | Where it is defined |
|---|---|---|---|---|
| NLA red | `#bf0f3e` | — | The academy: primary buttons, Operations pillar, Battle Team | `NLA_RED` (practicePlan.ts), `PILLAR_COLOR.operations` |
| Pillar green | `#22c55e` | — | Sales & Marketing pillar (Lap ring, message board) | `PILLAR_COLOR.sales_marketing` |
| Pillar blue | `#38bdf8` | — | Finance pillar (Lap ring, message board) | `PILLAR_COLOR.finance` |
| Today green | `green-400` `#4ade80` | target | Today's Plan — "today" | Workbench |
| Lap lime | `lime-400` `#a3e635` | flag | The Lap and weekly goals — "this week": the basket on a Workbench, goal controls on the Lap, the flag a placed goal wears | `LAP_GREEN` (lap/commitments.ts) |
| Gold | `#f0a500` | — | Non-Battle Team (Gym Board, NBT board) | `GROUPS` (practicePlan.ts), `NBT_AMBER` |
| Light blue | `#3da5e8` | — | Littles (Gym Board) | `GROUPS` (practicePlan.ts) |
| Teal | `#14b8a6` | — | Juniors Aftercare: Smile Lab / Life Lab, Bible Study blocks, the Junior Boxers strip | `SPIRITUAL_TEAL` |
| Together gray | `#a1a1aa` | — | Everybody-together moments: team meeting, nightly wrap-up | `TOGETHER_GRAY` |
| Violet | `#a78bfa` | — | "This week only" / differs from the template | `OFF_TEMPLATE_VIOLET` |
| Amber | `amber-300/400` | — | Notes, attachments, warnings, carried-once goals | Tailwind, by hand |
| Red-300 | `red-300` | — | Danger, removals, carried-twice goals | Tailwind, by hand |
| Emerald | `emerald-300/500` | check | Done / live on the board / reviewed | Tailwind, by hand |

Rules of thumb:

- A colour plus a mark beats a colour alone. Today = target, the Lap = flag.
- Gold and amber look alike on a dark wall; gold is Non-Battle Team, amber is
  a note or a warning. Keep them in different places.
- Two blues read as one from the floor. Finance blue lives on the Lap and the
  message board; Littles blue lives on the Gym Board. They never share a screen.
- Native `<select>` lists paint white-on-white on these dark surfaces. Use the
  app's `DropdownMenu`, or give the select a dark background.
