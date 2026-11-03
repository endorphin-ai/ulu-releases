# Changelog

What changed in each version of ULU, newest first. The full notes of each version are on its [release page](https://github.com/endorphin-ai/ulu-releases/releases).

Update with **Help → Updates** in ULU, or `brew upgrade --cask ulu`.

## 0.4.2: talk to El Capitan while the team works

- **Message El Capitan any time.** While the team works, write a change, a detail or a correction and press Send. No pause needed. El Capitan passes it on to the bees it concerns.
- **Existing branch for a new session.** New session can also start on a branch you already have, or on one that is only on GitHub.
- **Files created.** Each bee shows how many files it created and how many it changed.

## 0.4.1: questions you cannot miss, and every file of a session in one place

- **Questions on top.** A question of the team is pinned on top of El Capitan, and the top bar shows **1 decision waits for you · Answer** on every tab.
- **Session files.** One button opens every file the bees wrote in a run, grouped by bee.
- **New or changed.** Each file a bee wrote says whether it made the file or changed it.
- **Folders in Git.** Changes show as a list or as a folder tree.
- Fixed: a question was hidden while an earlier run was open in El Capitan.

## 0.4.0: sessions with El Capitan, each on its own branch

- **New session** starts a new talk on a new git branch. Files you have not committed come along.
- **The branch on top.** El Capitan shows the branch of the talk, and every run shows its branch. Search finds runs by branch.
- **Read an earlier run.** Click a run and El Capitan shows its whole talk.
- **Switch branches in Git** from the menu on top, also to a branch that is only on GitHub.

## 0.3.9: run all your tests, and see them as a test pyramid

- **Run tests.** The Test tab finds every test suite of your project and runs them with coverage.
- **Test pyramid.** End-to-end, frontend and backend, each with its tests, failures and coverage.
- **Ask the team** to run every test against the running app, or to write user stories from the code.
- Long tables show 20 rows at a time. **Project** moved to Work, next to the Hive.
- Fixed: huge pull requests show their lines again.

## 0.3.8: builds that fix themselves, and one step at a time

- **Builds fix themselves.** When the last check finds a missing file, ULU asks Claude to fix just those files. **Fix the problems** does it again.
- **Calm messages**, with the technical text under **Details**.
- **Build logs** for every build.
- **One step at a time:** Brief, Design, Build, then Work.
- **Ask before stopping.** Stop, Start again and Redo ask first.
- ULU writes the team's part of `CLAUDE.md` and `AGENTS.md`, and keeps the rest.

## 0.3.7: teams that know your existing project

- **Existing projects.** Brief, Design and Build read the project first: its stack, scripts, tests and documents.
- **Build the changes.** Build only what changed in Design.
- **Build history** of every build, resume, stop, check and install.
- Ready teams are chosen in Design. The brief asks what kind of app it is.
- The team keeps its work items in `dev-docs/`. Your `docs/` folder stays yours.
- Git: close a file of a diff, or mark it **Viewed**. You can keep `.squad/` out of git.
- Many build fixes, and much less memory with long session logs.

## 0.3.6: beta keys work offline

- **Beta keys work offline**, with no internet and no account.
- **Sign in in the browser** opens the browser directly.

## 0.3.5: finished teams open straight into work

- Finished teams are no longer sent back to "Set up your team".
- Ready teams install from Brief or Build.
- Pause, Stop and Continue act on the task you are looking at.
- Saving the brief always saves it.

## 0.3.4: nine dead ends in the window are fixed

- Test: a failed check keeps its card, with **Write a bug** right there.
- Coverage refreshes after a check, and old manual passes show as old.
- Finished tasks lead to their reports and test results.
- Ask opens commits and runs it mentions, and **Back to Ask** keeps your chat.
- Retry buttons for diffs, reports and ready teams.

## 0.3.3: a smoother, more accessible window

- Motion that shows where you are, and none when your Mac asks for reduced motion.
- Arrow keys move between tabs. A "Skip to the content" link for keyboard users.
- Bigger touch targets, clearer focus and a high-contrast mode.

## 0.3.2: seven more fixes, found by an audit

- Building or applying a change can no longer delete files outside your project.
- A failed or stopped Apply puts everything back.
- ULU no longer replaces a settings file it cannot read.
- The file viewer no longer shows secret values of `.claude/settings.json`.

## 0.3.1: 35 fixes

- ULU Remote is safer: no replayed commands, a stable Remote key, removed phones stay removed.
- Usage-limit resume is reliable.
- Notifications reach you for every project.
- Updates, the phone app and the window are more robust.

## 0.3.0: the hive waits out your Claude usage limit

- When your Claude limit is reached, the task pauses and goes on by itself after the reset, in the same session.
- Notifications when the task pauses and when it works again.
- **Continue now** goes on sooner. ULU keeps your Mac awake while a task waits.

## 0.2.0: notifications on your Mac, and ULU Remote on your phone

- **Mac notifications** when a task is done, when the team needs you, when a team is built, and when Kukulu answers.
- **ULU Remote (paid):** watch the hive from your phone, answer questions, stop a task. Encrypted end to end.
- **Update Claude Code** button.

## 0.1.0: the first release

- **Studio:** write a brief, design your team with Kukulu, build it, and see reports, the project board and the passport.
- **10 ready teams:** Elixir & Phoenix, Node & React, Next.js, FastAPI & React, Go & React, Django, Rails, Laravel, Flutter & Firebase, Expo & Supabase.
- **Work:** watch the hive, ask about your code, review changes and merge pull requests, check the app by hand, see coverage, view mockups.
- **Phone:** see an Expo app on screen, on your phone or in the iPhone simulator.
- **Ship:** deploy to Render and connect a domain through Cloudflare.
- **Set up this computer:** one button installs git, the GitHub CLI, Node.js, Claude Code and Ollama.
- **Safe updates:** signed and checked, with automatic roll back.
