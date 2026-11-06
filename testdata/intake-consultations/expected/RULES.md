# Answer-key rules

Decided by James on 7 November 2026 for [Draft the synthetic consultation test set](https://github.com/Jp8617465-sys/real-estate-app/issues/56). They build on the intake decisions in [Decide how consultation transcripts become reviewed records](https://github.com/Jp8617465-sys/real-estate-app/issues/54). The keys describe what a correct, cautious extraction suggests, and the first tracer bullet's pass bar is measured against them.

1. **Quotes.** Copy each quote character for character from one cue, speaker turn or notes line, including any transcription errors. Normalise a value only when certain: "Cooper Roo" becomes Coorparoo, but "Abbots Lee" stays as spoken.
2. **Speakers.** Use each speaker's label as it appears in the transcript. A statement from someone outside the household is theirs; it never becomes a buyer requirement. A speaker's identity may be inferred from how people address each other. Notes files use "notes (agent)".
3. **Stated or inferred.** Every item is marked stated or inferred. Leave an item out rather than infer it loosely.
4. **Key items.** The key items are the budget target, budget ceiling, pre-approval amount (or a broker borrowing estimate, labelled as such), every deal-breaker and every next action.
5. **Ceilings.** A limit given by a broker or the agent is that person's finance fact. The buyers' ceiling stays empty and appears under "Not covered on this call". The exception is when a buyer explicitly accepts the figure as their limit: the ceiling is then inferred, quoting both.
6. **Silence isn't agreement.** An item from agent playback or an agent prompt counts only when a buyer explicitly confirms it. Otherwise it goes under "Confirm with client".
7. **Wording decides the category.**
   - A must-have uses need, must, has to, non-negotiable, important or really important.
   - A deal-breaker rules something out: "no…", "don't want…", "won't…".
   - Anything else the buyers want is a nice-to-have.
   - Count each item once.
   - An inferred must-have is allowed where a lasting fact requires it, such as owning a pet requiring pet-friendly by-laws.
   - "Not keen" is a preference, not a deal-breaker.
8. **Next actions need a commitment:** "I'll…", "we'll…", or agreeing to a request. Mark a conditional action "(if they proceed)" and a completed one "done". Advice, open offers and the buyers' private plans are not next actions.
9. **Areas come from the buyers.**
   - A buyer names the area, or it is inferred as open to because they inspected, booked or bid there.
   - An area only the agent suggested stays out unless a buyer explicitly agrees.
   - A tentative "maybe?" goes under "Confirm with client".
   - An area that was ruled out stays out unless it is revisited.
   - When a couple differ, attribute each area to the person who named it.
10. **Never suggested:** sensitive or subjective details, such as family planning, health, the agent's personality notes, or the broker's breakdown of income and debt. Keep only the resulting borrowing limit and any timing the buyers state themselves.
11. **Professionals** are recorded only for a named person or firm acting for the household, or the referrer. Unnamed or future professionals go to brief notes at most.
12. **Service wanted** stays empty until the client chooses.
13. **Outcomes for mentioned properties:** missed, already seen or pursuing.
14. **Conflicts.**
    - A disagreement between decision makers stays unresolved, "to discuss".
    - A value superseded later in the call is shown only as the earlier value.
    - A suggestion never replaces an existing value without acceptance.

## Checking the keys

`python3 testdata/intake-consultations/check_quotes.py testdata/intake-consultations testdata/intake-consultations/expected`

The script confirms that every quote sits inside a single cue, turn or line and matches its row's speaker. It exits non-zero on any failure. Warnings flag quotes under 4 or over 25 words, and quotes that appear in more than one place.
