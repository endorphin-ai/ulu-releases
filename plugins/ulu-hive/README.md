# ULU Hive for Claude Code

Watch El Capitan's bees work, right in Claude Code, as in the [ULU](https://ulu.software) app: every bee a 🐝 that wiggles while it works, its role on a chip in the role's color, and what it is doing now.

- **Tabs** at the top of the pane: Hive, Board and Stats. Click one, or press 1, 2 or 3.
- **Hive** (`/hive`): the run's cost, tokens and time; each bee with its role, model and effort, its steps (3/5 · Hero copy), context, tokens, cost and time, and a progress bar in its role's color. Finished bees fold away; planned steps show what they wait for.
- **Board**: the project's work items from dev-docs/ (PRDs, TRDs, stories, test cases, bugs) by column, with decisions and risks below, as on ULU's board. It reads them again when the team writes one.
- **Stats**: cost, tokens and time by role, and El Capitan's context.
- **The chain** above the prompt: El Capitan's plan, the step at work lit.
- **The status line**: `🐝 2 working · 3 finished · $0.25 · 0:28`.

It works with any team of subagents, not only ULU's.

**See it without a team:** `/hive demo` plays a made-up run (bees working, steps going by, a board and stats); `/hive demo off` clears it. A real bee ends the demo too.

## What it does not do

It only watches. It sends nothing anywhere, makes no model call (it costs nothing), and holds none of ULU's prompts or skills. Commands and titles it shows are searched for keys, tokens, e-mail addresses and home folders first, so the pane is safe to show on screen.

Cost at the top is the session's own figure; a bee's cost is an estimate from its tokens (≈).

## Where it shows

In Claude Code's **fullscreen view** the hive docks beside the talk, and its tabs take clicks. On the **main screen** (inside tmux, or with `CLAUDE_CODE_NO_FLICKER=0`) a pane cannot dock: `/hive` opens it above the prompt with the keyboard, so **1**, **2** and **3** switch tabs and **Esc** goes back to the prompt; it does not open by itself there, a note says `/hive` shows it. To get the fullscreen view inside tmux, start Claude Code with `CLAUDE_CODE_NO_FLICKER=1 claude`.

## Settings

- `autoOpen` (on): open the pane when you type `/el-capitan`, and when the first bee of a session starts.

## Install

In ULU: **Settings → Claude Code mode → Install**. Or in Claude Code:

```
/plugin marketplace add endorphin-ai/ulu-releases
/plugin install ulu-hive@ulu
```
