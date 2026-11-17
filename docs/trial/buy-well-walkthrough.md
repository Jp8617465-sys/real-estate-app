# Buy Well trial: a 15-minute walkthrough

For a buyers agent trying the prototype on **synthetic** clients. Nothing here is real: every person, property and agency is invented, and no real client data should be entered. Extraction and integrations are stand-ins, labelled on screen. Treat everything you see as a prototype to react to.

## Start it

On the Mac running it: `make demo`, then open http://127.0.0.1:8000. (This erases the local demo database and loads synthetic data. `make reset` empties it; `make seed` loads data into an empty app.)

## The walk

1. **Pipeline** (left menu). Eight engagements across the stages. Open a card. Are these the right stages for how you work? (They are provisional.)
2. **Clients.** Search "Nguyen" or a mobile number typed with spaces. Open Linh Nguyen: households, partner relationship, the buying opportunity. Try adding a client with an email that already exists and see the warning.
3. **The Nguyen-Hall engagement.** Read the brief: each value shows where it came from, and replaced values stay in its history. Change the bedrooms and look at the history.
4. **Shortlist.** Three properties with assessments and ticks against the brief. Press "Look up details (synthetic data)" on 12 Example St and see what it fills, and what it will not overwrite. Try a drive time to Chermside.
5. **A real call.** Open "Tash and Rhys (call 03)". The values in its brief came from a discovery-call transcript you can open from the engagement; each has the quote beside it. In a fresh engagement, upload one of the transcripts in `testdata/intake-consultations` and run the review yourself: match the speakers, notice what is flagged, accept the rest, finish.
6. **Professionals, tasks, timeline.** The broker and conveyancer are one record used on several engagements. Tick a task done; look at the timeline.
7. **Book a discovery call** on the Kim enquiry: propose times, book one, download the invitation. It sends nothing.
8. **Feedback** (left menu): write down what was confusing and what is missing.

## What to tell us

- Which step would you do daily? Which would you never use?
- What do you track that is not here?
- What would you need to trust it with a real client?

## What is not real

- Property data, maps, mail and calendar, and identity checks are synthetic stand-ins (see the Integrations page). No provider is connected.
- Call extraction replays recorded answers for these transcripts; a language-model option exists but is not enabled.
- There is no login: whoever has the screen can change anything.
- Real client conversations must not be used: the language-model path runs outside Australia, and identity-check requirements are not settled.
