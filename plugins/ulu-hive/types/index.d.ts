// The hive's data: what the hooks keep in $.state and the pane draws.

export type StepStatus = 'pending' | 'in_progress' | 'completed'

export type Step = {
  id: string
  subject: string
  status: StepStatus
  blockedBy: string[]
}

export type BeeStatus = 'running' | 'done' | 'failed' | 'stopped'

export type Bee = {
  id: string // the agent id
  role: string // the agent type, e.g. go-dev-gocli
  title: string // the Agent call's short description
  bee: string // which picture
  model: string
  effort: string
  status: BeeStatus
  startedAt: number
  endedAt: number
  tokens: number // new tokens: input, output and cache writes, all of its requests
  cacheRead: number // context read again from the cache, all of its requests (cheap, and not new)
  round: number // 1, then 2, 3 when El Capitan sends it a new task (SendMessage)
  nth: number // 1 for the first bee of its role in the run, 2 for the second, ...
  costUsd: number // an estimate from the tokens
  ctxTokens: number // what its last request held
  doing: string // what it does now, made safe to show
  steps: Step[]
}

export type Run = {
  title: string
  startedAt: number
  endedAt: number // 0 while it goes on
  isMainBusy: boolean
  mainTokens: number // El Capitan's new tokens
  mainCacheRead: number
  window: number // the session's context window, from the ledger; 0 unknown
  mainCostUsd: number
  doing: string // what El Capitan does now
  plan: Step[]
  bees: Bee[]
  costBase: number // the session's cost when the run began; -1 unknown
  exactCost: number // what the run has cost, from the session's ledger; -1 unknown
  isDemo?: boolean // made up by /hive demo
}

export type Usage = {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

export type Column = 'todo' | 'in_progress' | 'in_review' | 'in_qa' | 'done'

export type BoardItem = {
  path: string // from the project folder
  type: string // user_story, prd, trd, bug, decision, risk, ...
  ref: string // US-003, or ""
  title: string
  status: string // as the file writes it
  column: Column
}

export type Board = {
  docs: string // the docs folder, "" when the project has none
  items: BoardItem[]
  skipped: number // files past what one read takes
  readAt: number
}

export type View = 'hive' | 'board' | 'stats'

declare module 'claude-code' {
  interface PluginState {
    'ulu-hive': {
      run: Shaped<Run | null>
      tick: number
      isFinishedFolded: boolean
      isBandHidden: boolean
      view: View
      board: Shaped<Board | null>
      isDoneFolded: boolean
    }
  }
}
