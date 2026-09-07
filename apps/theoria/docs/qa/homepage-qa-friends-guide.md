# A quick look at my new web page — about 20 minutes, no tech knowledge needed

Here's the link: **https://theoria-pr-93.staging.scenesystems.io**

I've rebuilt the front page of a website and I want to know how it looks and feels to a normal person before I show it to the world. You don't need to understand what the site is for — in fact it's better if you don't. I care about three things:

1. **Does it look good?** Finished, calm, and easy on the eyes — or messy, cramped, or cheap-looking?
2. **Can you read and reach everything?** Nothing cut off, nothing too small, nothing you can't tap.
3. **Does it feel nice to use?** Nothing jumps, flickers, or does something you didn't expect.

Please open it on **your phone** first. If you also have a tablet or a laptop, do it again there — it looks different on each and I can't check them all myself.

---

## How to tell me what you see

The best feedback is **a screenshot plus one sentence.** Like:

> "The circles overlap the words here" + screenshot
> "This looked like a button but nothing happened" + screenshot
> "Way too much empty space on my iPad" + screenshot

Also tell me **what device and browser you're on** ("iPhone 13, Safari" / "Samsung, Chrome" / "iPad" / "Windows laptop, Edge") — just once at the start.

**How to take a screenshot:**

- iPhone: press the side button and volume-up together
- Android: press power and volume-down together
- Mac: Cmd + Shift + 3
- Windows: press the Windows key + Shift + S

If something is _moving_ weirdly (flickering, jumping), a short screen recording is even better — on a phone, swipe down to your quick controls and look for "Screen Record".

Don't hold back on opinions. "I don't like this", "this is boring", "this is confusing", "this bit is lovely" — all useful. There's no wrong answer, and you can't hurt my feelings.

---

## The parts of the page, and what I call them

I use a few nicknames below that won't mean anything to you yet. Here's a map of the page from top to bottom, with what each part looks like, where it is, and what it does if you touch it. Skim it now and come back to it if a name in the tour confuses you. **If you can't find something from this list, that itself is useful feedback — tell me.**

### The top of the page

**Top bar** — The thin strip across the very top. On the left: the word _Theoria_. On the right: the word _Docs_, a small GitHub logo (a cat-like circle), and the **sun/moon icon**. Tapping the sun/moon switches the whole page between a light look and a dark look.

**Headline** — The biggest text on the page: _"Scientific computing and model programming with Effect."_ Under it, one short paragraph.

**The two buttons under the headline** — A filled, solid-coloured button that says _Browse the packages_, and next to it a plain text link _See how it's built_. The first takes you to another page. The second scrolls you down this page.

### The demonstration

Everything below the headline, down to the code at the bottom, is one interactive demonstration. It shows an imaginary place (a lighthouse, a market, a library) being written and drawn in front of you. You'll see the heading **"The packages at work"** and one sentence introducing it.

**Story chooser** — Three short names side by side: _Unfinished light_, _Lost market_, _Drowned library_. One is highlighted as the current one. Tapping another changes everything below to that story.

**Brief box** — A text box a few lines tall, labelled _Brief_, containing a short description of the imaginary place (e.g. "A lighthouse on a rock you can only reach at low tide…"). You can type in it. A small count like _142 / 280_ sits near it.

**Features** — A short line under the Brief that lists the named parts of the place (e.g. "the lamp", "the letter") written as words in a sentence. Each name matches a circle on the paper. Hovering or tapping a name lights up its circle. Near here you may see a small label _Recorded inference_.

**The paper** — The most important thing on the page. A pale, roughly page-shaped rectangle, slightly different in colour from the background, with a short piece of writing on it and a handful of small circles scattered over it. Think of it as a sheet of paper the demonstration is drawing on. On a laptop it sits on the right and stays put while you scroll; on a phone it's in the flow of the page. Above or beside it you'll see _Drawn at_ with a time, a slider labelled _Stage width_, and a _Draw again_ button.

**Circles** (on the paper) — Small round dots, each with a name written near it. Each one is a feature of the place. Tapping or hovering one opens a **note**. When you change something, the circles slide to new positions. A brand-new circle arrives first as a **dotted ring**, then becomes solid.

**Lines of writing** (on the paper) — The prose on the paper. Each line can be tapped or hovered for a **note** about which part of the story produced it. It waits a moment longer than a circle does before opening.

**Note** — The little pop-up box that appears when you tap or hover a circle, a line of writing, a code, a knot, or various other things. It explains where that thing came from. Tap anywhere blank (or press Escape on a keyboard) to close it. Some notes contain a _Copy_ button; tapping it says _Copied_.

**Knots** — A small row of dots beside the paper, one per version of the place. The current version's dot is filled in; earlier ones are hollow. Next to the filled one is a version name like _V1_ or _V2_, and a **long code**. Each knot can be tapped/hovered for a note.

**Long codes** — Strings of letters and numbers that look like _a3f9c2e1…_ — you'll see them next to knots and inside some notes. Each one is a fingerprint of a version. They can be tapped for a note and copied.

**Signatures** — Short lines like _"You signed · key 8f3a2c1d"_ appearing near knots or under suggestions. They can also be tapped for a note.

**Suggestions** — Below the paper, a list of two or three short entries, each with a thin vertical line down its left side. Each is a suggested addition to the place, labelled with who suggested it (_You_, _Neighbor_, or _Program_), and has sections _Adds_ and _Why_. One may have a _Note_ with the text _Opened with your key_.

**Merge switch** — A small on/off toggle labelled _Merge_ on each suggestion. Flipping it on adds that suggestion to the place: the writing on the paper changes, a new circle arrives, and the switch is replaced by the word _Merged_. Flipping it off undoes it.

**Faded circles** — Occasionally a paler, see-through circle appears on the paper for a suggestion that hasn't been merged yet. That's intentional — a ghost of what _would_ be added.

**Trial dots / wavy line** — Near the paper you may see a small row or line of tiny dots with a caption like _Trial 12 of 40_. This shows the demonstration trying different arrangements before settling. Each dot can be tapped for a note.

**Strip at the top** — On a phone or tablet only: once you've scrolled the paper off the top of the screen, a thin bar with tiny copies of the circles sticks to the top edge. Tapping it scrolls you back up to the paper. It disappears when the paper is back in view.

### The bottom of the page

**"How it's built"** — The last big section. A heading, three **tabs** in a row (_Compose_, _Arrange_, _Build_) with a thin underline under the current one, and under them a **code block**.

**Code block** — A box of computer code with grey **line numbers** down the left edge. You don't need to read it. Some line numbers can be tapped or hovered for a note; some lines have a small **annotation** attached (a short label beside the line) that can also be tapped.

**"In the reference" / "Source"** — Two short lists of links under the code.

**Footer** — The very bottom of the page.

### Words I use for how things behave

**Placeholder** — The faint grey shapes you see for a split second before the paper first appears. Fine if brief; a problem if it flickers, turns red, or hangs around.

**Working / settled** — "Working" is when the paper is mid-change (circles sliding, writing swapping). "Settled" is when everything has stopped moving.

**Hover** — On a laptop, resting the mouse pointer on something without clicking. On a phone there's no hover; tapping does both jobs.

**Lights up** — When you touch one thing and a related thing elsewhere gets highlighted (e.g. hover a feature name, its circle brightens).

---

## What's new — compare it with the current site

The version that's live today is here: **https://theoria.scenesystems.io**
The new version is here: **https://theoria-pr-93.staging.scenesystems.io**

Open both, one after the other, on the same device. Same page, redesigned. Here's what I changed, in plain terms, and the question I'd like answered for each:

| Old (live today)                                                                                                      | New (the one you're testing)                                                                                                        | What I want to know                                                                                    |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| The whole demonstration sits inside one big raised box with a title "An imagined place" and a paragraph explaining it | No box. The demonstration sits straight on the page under the heading "The packages at work", with one short line of introduction   | Does it still feel like one clear "thing", or does it now feel scattered? Do you miss the explanation? |
| Suggestions are shown as separate cards, each with little coloured labels and rounded "pills"                         | Suggestions are a plain list, each with a thin line down its left side, and names written inline                                    | Does the list look tidier or flatter/duller? Can you still tell one suggestion from the next?          |
| The place's features are shown as little rounded "chips"                                                              | Features are written as names in a sentence                                                                                         | Is it clear these names match the circles on the paper?                                                |
| Top-right has a boxed "star on GitHub" button with a number, and boxed buttons                                        | Top-right is plain text and small icons, no boxes                                                                                   | Does the top bar feel cleaner, or does it feel like something's missing?                               |
| Circles on the paper mostly jump to their new places                                                                  | Circles slide to their new places, and a new one arrives as a dotted ring before turning solid                                      | Calm or fussy? Too slow, too fast, just right?                                                         |
| Tapping things opened a note here and there                                                                           | Almost everything can be tapped or hovered for a note: circles, lines of writing, the long codes, dots beside the paper, code lines | Could you _tell_ which things were tappable before you tried? (This is the big one.)                   |
| No strip at the top when scrolling                                                                                    | A thin strip with tiny circles sticks to the top of the screen once the paper scrolls away (phone/tablet)                           | Helpful, annoying, or didn't notice?                                                                   |
| Version numbers shown as rounded labels on the paper                                                                  | Versions shown as small dots ("knots") beside the paper with a code next to each                                                    | Does it read as "a history of versions", or as mystery decoration?                                     |

You don't need to fill in the table — just have a look at both and tell me, in a sentence or two: **which one looks more finished, which one is easier to use, and anything you preferred about the old one.**

---

## The things I'm most curious about

These are the questions running through my head. If you can answer any of them for me, wonderful.

**1. Could you tell what was tappable?**
On the new page, lots of things respond when you tap or hover — but none of them look like buttons. As you go through the tour, notice: did you _guess_ something was interactive before you touched it, or did you only find out by accident? Was there anything you tapped expecting a response that did nothing? Tell me both kinds.

**2. Did things change state clearly?**
When you tap a story, flip a switch, or open a note, something should visibly change to confirm it happened: the chosen story looks chosen, the switch says "Merged", the tapped circle lights up. Did you ever do something and think "did that work?" Where?

**3. Was the timing right?**
Some things wait a beat before they respond on purpose — a note opens a moment after you hover, and waits a bit longer on a line of writing than on a circle, so it doesn't fire while you're just passing over. Did anything feel laggy or broken because it waited too long? Did anything pop up too eagerly while you were just moving past?

**4. The three moods of the paper**
The paper goes through three moods every time you change something:

- **Empty / getting ready** — a faint grey placeholder before anything appears (you'll see this the moment the page loads).
- **Working** — the circles are on the move and the writing is being swapped.
- **Settled** — everything's landed and still.

Watch the hand-off between these. Did the placeholder flash a wrong colour or a red message before the paper appeared? Did the paper suddenly change size between "working" and "settled" and shove the page? Did anything from the old version linger on top of the new one, or fade out too slowly? Did "settled" ever leave a stray scrollbar, a faded edge, or a half-drawn circle behind?

**5. Does everything line up?**
Look at the page like you'd look at a poster on a wall — is anything a bit off?

- Is the headline lined up with the paragraph and the buttons under it, or does something sit a few pixels to one side?
- Are the three story choices evenly spaced?
- Do the dots beside the paper line up with the paper's edge? Do the long codes next to them start at the same left edge?
- Do the three tabs (Compose / Arrange / Build) sit on one straight line, with the underline exactly under the chosen one?
- In the top bar, are the name on the left and the icons on the right at the same height?
- On a laptop: is the page centred in the window, or does it lean left or right?
- On a phone: is the left margin the same width as the right margin all the way down?

If something's off, screenshot it and just say "this looks crooked" — I'll take it from there.

**6. Is anything the wrong size?**
Circles too small to tap. Text too small to read. Headline too big. Notes that are wider than the screen. Empty gaps that are far bigger than the ones around them. Tell me about anything that looks like it belongs to a different-sized page.

---

## The tour — 8 stops

Go through these in order. At each stop: **do the thing, look, and tell me.**

### Stop 1 — The very first glance

**Do:** Open the link. Don't scroll. Don't tap anything. Just look for five seconds.

**Look at:**

- Did anything flash, flicker, or shuffle around while it loaded?
- Is the big headline easy to read? Does it break into lines nicely, or is there one lonely word on its own line?
- Does it look like a real, finished website, or like something half-built?

**Tell me:**

- **Take a screenshot of this first screen and send it to me. This is the single most useful thing you can do.**
- One word for how it feels: e.g. calm / busy / plain / elegant / cheap / confusing.

---

### Stop 2 — Scroll all the way down, then back up

**Do:** Scroll slowly to the bottom of the page. Then scroll slowly back to the top.

**Look at:**

- Does anything get cut off at the left or right edge?
- Can you swipe the page _sideways_? (You shouldn't be able to. If you can, that's a problem — screenshot it.)
- Are the gaps between sections comfortable — or are some parts squashed together and others floating in a sea of empty space?
- **On a phone:** as you scroll past **the paper** (the pale rectangle with circles on it), the **strip at the top** — a thin bar with tiny circles — should appear stuck to the top of the screen. Did it show up? Did it get in the way of anything? Tap it — it should take you back up to the paper.
- **On a laptop:** the paper should stay put on the right while the left side scrolls. Does it? Does it ever overlap or cover words?

**Tell me:**

- Anything cut off, anything you could swipe sideways, anything that felt too cramped or too empty.
- Whether the strip at the top (phone) or the pinned paper (laptop) behaved.

---

### Stop 3 — Light and dark

**Do:** At the very top right there's a small sun/moon icon. Tap it. The page should switch between a light look and a dark look. Tap it again to switch back.

**Look at:**

- Did _everything_ switch? Look for any bright white box left behind in dark mode, or a dark patch left behind in light mode.
- Is the text still comfortable to read in both?
- Which one do you prefer, honestly?

**Tell me:**

- A screenshot of the page in the mode you _didn't_ start in.
- Anything that looked wrong or left out.

---

### Stop 4 — The paper and the circles

Scroll to the section headed **"The packages at work."** Below it is **the paper**: a pale rectangle with a short piece of writing and a few small **circles**, each with a name written near it. (See "The parts of the page" above if you're not sure you've found it.)

**Do:** Look at it closely, then **tap one of the circles.** A **note** should pop up explaining it. Tap somewhere blank to close it. Try another circle. Then **tap one of the lines of writing** — a note should pop up for that too (it takes a moment longer).

**Look at:**

- Do the circle names bump into each other or sit on top of the writing?
- Is any circle half off the edge?
- Was the circle easy to hit with your finger? Did you have to try more than once? Did you hit the wrong one by accident? **Be honest — I think they might be too small.**
- Did the little note appear near the thing you tapped, or somewhere odd? Was it cut off by the edge of the screen?
- Is the note easy to read?

**Tell me:**

- How many tries it took to open a circle.
- Screenshot of any note that appeared, and of anything overlapping.

---

### Stop 5 — Try a different story

Just above the paper there are three choices: **Unfinished light**, **Lost market**, **Drowned library**. Below them is a box of text (the "Brief").

**Do:** Tap a different story. Watch the paper as it changes. Then tap another one. Then tap between them quickly a few times.

**Look at:**

- Did the writing on the paper change? Did the circles move to new places?
- Did the change feel _calm_ (things slid gently into place) or _frantic_ (things jumped, flickered, or piled on top of each other)?
- Did the paper suddenly get much taller or shorter and shove the page around?
- After tapping quickly, did anything get stuck, look wrong, or leave a little empty note floating around?
- Can you tell which of the three is currently chosen?
- On a phone: do the three choices fit on screen, or does one run off the edge?

**Tell me:**

- Calm or frantic?
- Anything that jumped, stuck, or looked broken. A screen recording is great here if you can.

---

### Stop 6 — Type in the box

**Do:** Tap inside the Brief text box. Change a few words — delete some, type some.

**Look at:**

- On a phone, when the keyboard slid up, did it cover the box you were typing in? Did the page jump?
- After you changed the words, did the paper below rebuild itself? Did the page lurch downward and back?
- Try deleting _all_ the text. A message should appear. Is it friendly and clear, or alarming/confusing?

**Tell me:**

- Whether typing felt normal, and what the message said when you emptied the box.

---

### Stop 7 — Flip a switch

Below the paper there's a list of short suggestions. Each has a small switch labelled **Merge**.

**Do:** Flip one switch on. Watch what happens. Then flip it off. Then flip two switches in a row quickly.

**Look at:**

- When you flipped it on, did a new circle appear on the paper and the writing change? Did it look deliberate (a dotted ring that becomes a solid circle) or glitchy?
- Did the switch change to say **"Merged"**?
- When you flipped it off, did everything go back cleanly?
- **On a phone, the paper is probably above you, off the screen when you flip the switch.** Could you tell anything had changed? Did you feel like you had to scroll up to find out? _(This is a question I really want your honest answer on.)_

**Tell me:**

- Whether you could tell what the switch did without hunting for it.
- Anything that looked glitchy.

---

### Stop 8 — The code section

Near the bottom there's a section called **"How it's built"** with three tabs: **Compose**, **Arrange**, **Build**, and a block of computer code under them. You don't need to understand the code at all.

**Do:** Tap each of the three tabs.

**Look at:**

- Is it obvious which tab is selected?
- Did the page jump around when you switched tabs?
- Does the code look tidy and readable — or muddy, neon, or squashed?
- On a phone: can you swipe the code sideways _inside its own box_ (fine) — or does swiping drag the whole page sideways (not fine)?
- Do the small notes attached to some lines of code look okay? Tap one — does a note pop up?

**Tell me:**

- Whether the tabs made sense and whether the code area looked neat.

---

## Last three questions

Answer these in a sentence each:

1. **What do you think this website is for?** (Guess. There's no wrong answer — I want to know what it _says_ to you.)
2. **What was the most confusing or annoying moment?**
3. **What was the nicest moment, or the thing you liked most?**
4. **Old page or new page — which would you rather use, and why?**

---

## If you have an extra 5 minutes

Only if you feel like it:

- **Turn your phone sideways.** Does the page still look okay?
- **Make the text bigger** in your phone's settings (Settings → Display → Text size, or Accessibility → Larger Text). Reload the page. Does anything overlap or get cut off now? Screenshot it.
- **On a laptop:** slowly drag the window narrower and wider. Does it rearrange itself smoothly, or does something break at a certain width? Also try zooming in (Ctrl or Cmd and the + key, twice). Does a sideways scrollbar appear at the bottom?
- **On an iPad:** try it both upright and sideways. Send me a screenshot of each — I want to see which layout it picks.

---

Thank you. Even one screenshot of your first screen and one sentence is a real help.
