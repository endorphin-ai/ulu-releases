// What the hive shows can be on a shared screen or a stream: commands and
// titles are searched for keys, tokens and home folders before they show.

const SHAPES: [RegExp, string][] = [
  [/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/g, '[hidden key]'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g, '[hidden]'],
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, '$1 [hidden]'],
  [/\bsk-[A-Za-z0-9_-]{16,}/g, '[hidden]'],
  [/\b(?:gh[pousr]|github_pat)_[A-Za-z0-9_]{16,}/g, '[hidden]'],
  [/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, '[hidden]'],
  [/\b(?:rnd|npm|glpat|xox[bpas])[_-][A-Za-z0-9_-]{10,}/g, '[hidden]'],
  [/\bAIza[0-9A-Za-z_-]{30,}/g, '[hidden]'],
  // A password in a URL: postgres://user:pass@host, https://x:token@github.com
  [/\b([a-z][a-z0-9+.-]*:\/\/[^/\s:@]*):[^@\s/]+@/gi, '$1:[hidden]@'],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[e-mail]'],
  // A value after a key named as a secret: GITHUB_TOKEN=…, --password x, "secret": "…"
  [
    /([A-Za-z0-9_.-]*(?:api[_-]?key|apikey|access[_-]?key|secret|token|passw(?:or)?d|private[_-]?key|credentials?)(?:[_.-][A-Za-z0-9_.-]*)?["']?(?:[ \t]*[:=][ \t]*|\s+))(?:"[^"\n]*"|'[^'\n]*'|[^\s"',;}]+)/gi,
    '$1[hidden]',
  ],
  [/\b[A-Fa-f0-9]{40,}\b/g, '[hidden]'],
]

export function redact(text: string, cwd: string): string {
  let t = text
  if (cwd) t = t.split(cwd + '/').join('').split(cwd).join('.')
  t = t.replace(/(\/Users\/|\/home\/)[^/\s'"]+/g, '~')
  for (const [re, to] of SHAPES) t = t.replace(re, to)
  return t
}

// A path to show: inside the project, from the project; else its last two
// parts.
export function shortPath(p: string, cwd: string): string {
  if (!p) return 'a file'
  if (cwd && p.startsWith(cwd + '/')) return p.slice(cwd.length + 1)
  const parts = p.split('/').filter(Boolean)
  return parts.length > 2 ? '…/' + parts.slice(-2).join('/') : p.replace(/^\/(Users|home)\/[^/]+/, '~')
}
