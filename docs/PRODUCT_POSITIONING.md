# ZipList Product Positioning

ZipList is a warm little voice checklist.

The product loop is:

```text
talk -> list -> tick
```

That restraint is the product. ZipList should feel like opening a blank
Notepad window, except the blank page already knows you want a checklist.

## What It Is

- A quick way to speak a handful of things into one active list.
- A satisfying checklist for groceries, errands, packing, gear, chores, set
  lists, moving day, housemate jobs, and small shared runs.
- A local-first web app that works without an account for the core flow.
- A tactile, chunky, warm interface that makes ticking things off feel good.

## What It Is Not

- Not a task manager.
- Not a planner.
- Not a productivity dashboard.
- Not an assistant.
- Not a reminders app.
- Not an app that talks about AI in user-facing copy.
- Not a place for priorities, due dates, scores, streaks, urgency, or pressure
  unless a later feature proves it can stay calm.

## User-Facing Language

Use plain language:

- "Make a list by talking."
- "Add more whenever."
- "Tick things off."
- "Share the list when someone else needs it."
- "No dates. No priorities. No setup."

Avoid:

- "AI productivity"
- "optimize"
- "workflow"
- "manage your life"
- "smart planner"
- "never forget anything again"
- "voice-first list capture, not generic transcription" as repeated public copy

## Free Shape

The free version should prove the whole core idea:

- 3 local lists.
- Talk into the active list.
- Add, edit, delete, reorder, check, and uncheck items.
- Basic static share/export.
- Installable PWA.

## Contributor Shape

Contributor should make ZipList bigger, livelier, and shareable without making
the base app feel broken:

- More lists.
- Longer lists.
- Lists carried across devices.
- Live shared lists.
- Short share links for live rooms.
- Person colors/presence for who added or ticked an item.
- Extra tick/pop sounds, themes, and small delight controls.
- Optional one-tap tidy/sort tools, never automatic reordering by default.

Data ownership features should stay generous. Export should not feel like a
ransom note.

## Sharing Direction

Static sharing can stay as a link that imports a snapshot.

Live sharing should feel like:

```text
send link -> both people see the same list -> ticks update live
```

Good examples:

- A couple shopping.
- A band packing gear or checking a set list.
- Housemates doing chores.
- A trip packing list.
- A party or event run sheet.

Live lists can be time-limited later, but the user should still experience it
as a normal web link, not as a workspace.

## Implementation Notes

AI and transcription services are implementation details. Keep them out of
marketing, onboarding, modals, and primary metadata unless a technical document
or developer setup page specifically needs them.

When in doubt, choose the simpler checklist behavior over the cleverer task-app
behavior.
