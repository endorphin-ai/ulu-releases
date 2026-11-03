# FAQ and troubleshooting

## Getting started

**ULU says Claude Code is missing or not signed in.**
Open a terminal and run `claude` once to sign in. If Claude Code is not installed, use **Set up this computer** below the list of projects. It installs git, the GitHub CLI, Node.js, Claude Code and Ollama.

**Claude Code is old.**
Press **Update Claude Code** in **Set up this computer**. It runs `claude update` and shows any error.

**Sign in in the browser does nothing.**
ULU opens the sign-in page in your browser and shows a short code. Confirm the same code on the page. You can also get your free key on any device and paste it in **License**.

**Do I need to know how to code?**
No. Say what you want as a result, in your own words. The team does the rest. It helps to read what the team did, in the Hive, Session files and Git.

## While the team works

**The task stopped with "usage limit".**
Your Claude plan's limit was reached. The task is paused, not lost. It goes on by itself a minute after the reset. Keep ULU open. Press **Continue now** to go on sooner. See [The Hive and El Capitan](the-hive-and-el-capitan.md#usage-limits-ulu-waits-and-goes-on-by-itself).

**The team waits and nothing happens.**
Look for **1 decision waits for you** in the top bar. A bee needs your answer. Press it to go to the question.

**"Claude Code refused tool calls in this run".**
Nobody was there to allow a tool call, so Claude Code refused it. Choose a permission mode that lets the team do more, such as **Accept edits**, or stay near and answer questions. If the team saves its reports in `.claude/reports`, press **Move the reports out of .claude** in the Hive.

**I gave the wrong task.**
Press **Pause**, write what should change, and press **Continue**. Or just send El Capitan a message while it works. **Stop** ends the task for good.

**Do I need to keep ULU open?**
Yes, while a task runs or waits for a usage limit. ULU keeps your Mac awake while a task waits.

**Can I use the terminal instead?**
Yes. In a terminal in the project folder, run `/el-capitan Your task` in Claude Code. The run shows in the Hive too.

## The team

**ULU says "Set up your team", or that something is missing.**
The Hive checks the team's files. When something is missing, it says what and offers the fix. In **Build**, **Fix the problems** asks Claude to fix only the missing files.

**I changed the team in Design. Do I build again?**
Build offers to build only what changed. A model or permission change applies in seconds, with no Claude session.

**A build stopped.**
Open **Build**. A failed step offers **Resume from this step** and **Start again**. **Build history** keeps the log of every build.

## Files and privacy

**Where are my files?**
In your project folder. The team keeps its work items in `dev-docs/`. ULU keeps its own files in `.squad/`. Your `docs/` folder is left to you.

**Is my code sent somewhere?**
ULU works through Claude Code on your Mac. What Claude reads goes to Claude, as when you use Claude Code yourself. Search by meaning runs on your Mac with Ollama, and nothing leaves the Mac. Your Render and Cloudflare keys stay in the macOS Keychain.

**Does ULU change my CLAUDE.md?**
ULU writes only the team's part of `CLAUDE.md` and `AGENTS.md`, and keeps everything else in them as it was.

## Updates

**How do I update?**
Open **Help → Updates** in ULU, or run `brew upgrade --cask ulu`. The version is at the bottom left of the window, and the footer tells you when an update is out.

**An update did not start.**
ULU keeps the version you had. If a new version does not start, ULU goes back to the old one by itself. Then please [report a bug](reporting-bugs.md).

**How do I remove ULU?**
Run `brew uninstall --cask ulu`, or move **ULU** from Applications to the Trash. Your projects stay where they are.

## Still stuck?

[Report a bug](reporting-bugs.md). We read every issue.
