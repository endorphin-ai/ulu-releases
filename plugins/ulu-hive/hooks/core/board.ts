// The project board, read as ULU's board reads it: the work items in the
// docs folder (dev-docs/, or docs/ before ULU 0.3.7), one Markdown file each
// with a header between two --- lines that gives its title, id and status.

import type { Board, BoardItem, Column } from '../../types'

export type { Board, BoardItem, Column }

export const DOCS_DIRS = ['dev-docs', 'docs']

// Folder name → item type, as ULU's docs skill and common names write them.
export const FOLDER_TYPES: Record<string, string> = {
  epics: 'epic', epic: 'epic', sprints: 'sprint', sprint: 'sprint',
  prd: 'prd', prds: 'prd', trd: 'trd', trds: 'trd',
  user_stories: 'user_story', stories: 'user_story', 'user-stories': 'user_story', userstories: 'user_story',
  test_cases: 'test_case', 'test-cases': 'test_case', testcases: 'test_case',
  bugs: 'bug', bug: 'bug', risks: 'risk', risk: 'risk',
  decisions: 'decision', decision: 'decision', adr: 'decision', adrs: 'decision',
}

export const TYPE_NAMES: Record<string, string> = {
  epic: 'Epics', sprint: 'Sprints', prd: 'PRDs', trd: 'TRDs', user_story: 'Stories',
  test_case: 'Test cases', bug: 'Bugs', risk: 'Risks', decision: 'Decisions',
}

export const TYPE_COLORS: Record<string, string> = {
  epic: '#ffd34d', sprint: '#ffd34d', prd: '#f08a24', trd: '#4aa8ff', user_story: '#a877ff',
  test_case: '#2bb5a0', bug: '#e53935', risk: '#ff5c7c', decision: '#35d685',
}

const WORDS: Record<Column, string> = {
  todo: 'todo to_do backlog ready open new draft pending proposed planned not_started reopened next',
  in_progress: 'in_progress progress started wip doing active blocked in_flight in_build current',
  in_review: 'ready_for_review in_review review for_review',
  in_qa: 'in_qa qa testing in_test ready_for_qa',
  done:
    'done completed complete closed fixed resolved verified accepted approved mitigated superseded wont_fix wontfix ' +
    'duplicate cancelled canceled automated passed shipped released merged obsolete deprecated rejected past',
}
const COLUMN_OF = new Map<string, Column>()
for (const [col, words] of Object.entries(WORDS) as [Column, string][]) for (const w of words.split(' ')) COLUMN_OF.set(w, col)

export const COLUMN_NAMES: Record<Column, string> = {
  in_progress: 'In progress', in_review: 'In review', in_qa: 'In QA', todo: 'To do', done: 'Done',
}

export function columnOf(status: string): Column {
  let s = status.toLowerCase().trim()
  const cut = /\s+#|\s+[—–-]\s+|\s*\(|[,;:]/.exec(s)
  if (cut) s = s.slice(0, cut.index).trim()
  s = s.replace(/[ -]/g, '_')
  return COLUMN_OF.get(s) ?? COLUMN_OF.get(s.split('_')[0] ?? '') ?? 'todo'
}

// One item from its file's text. Only the header and the first heading are
// read: nothing of the body is kept.
export function parseItem(text: string, path: string, type: string): BoardItem {
  const slug = (path.split('/').pop() ?? path).replace(/\.md$/i, '')
  const fields: Record<string, string> = {}
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  let body = lines
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
    if (end > 0) {
      for (const l of lines.slice(1, end)) {
        const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(l)
        if (m) fields[m[1]!.toLowerCase()] = m[2]!.trim().replace(/^["']|["']$/g, '')
      }
      body = lines.slice(end + 1)
    }
  }
  const pick = (...keys: string[]) => keys.map(k => fields[k]).find(v => v && v !== '-' && v.toLowerCase() !== 'n/a') ?? ''
  const heading = body.map(l => /^#\s+(.+)/.exec(l)?.[1]).find(Boolean) ?? ''
  const title = pick('title', 'name', 'summary') || heading || slug.replace(/[-_]+/g, ' ')
  const ref = pick('id', 'ref', 'key')
  const status = pick('status', 'state')
  return {
    path,
    type,
    ref: /^[A-Za-z]{1,8}[-_]?\d+[\w.-]*$/.test(ref) ? ref : '',
    title: title.length > 120 ? title.slice(0, 119) + '…' : title,
    status,
    column: status ? columnOf(status) : 'todo',
  }
}

const ORDER: Column[] = ['in_progress', 'in_review', 'in_qa', 'todo', 'done']

// The work, by column; decisions and risks apart, as on ULU's board.
export function boardColumns(board: Board) {
  const work = board.items.filter(i => i.type !== 'decision' && i.type !== 'risk')
  const columns = ORDER.map(c => ({ column: c, items: work.filter(i => i.column === c) })).filter(c => c.items.length)
  const apart = board.items.filter(i => i.type === 'decision' || i.type === 'risk')
  const counts = Object.entries(
    board.items.reduce<Record<string, { total: number; done: number }>>((m, i) => {
      const c = (m[i.type] ??= { total: 0, done: 0 })
      c.total++
      if (i.column === 'done') c.done++
      return m
    }, {}),
  ).sort(([a], [b]) => Object.keys(TYPE_NAMES).indexOf(a) - Object.keys(TYPE_NAMES).indexOf(b))
  return { columns, apart, counts }
}
