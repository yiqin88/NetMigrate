import { useState, Suspense, lazy } from 'react'
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued'

// Monaco is large (~2 MB) — lazy load it
const MonacoEditor = lazy(() =>
  import('@monaco-editor/react').then((m) => ({ default: m.default }))
)

const DIFF_STYLES = {
  variables: {
    dark: {
      diffViewerBackground: '#0f1117',
      diffViewerColor: '#e6edf3',
      addedBackground: '#1a3a2a',
      addedColor: '#e6edf3',
      removedBackground: '#3a1a1a',
      removedColor: '#e6edf3',
      wordAddedBackground: '#2d5a3d',
      wordRemovedBackground: '#5a2d2d',
      addedGutterBackground: '#1c2f23',
      removedGutterBackground: '#2f1c1c',
      gutterBackground: '#161b22',
      gutterBackgroundDark: '#0f1117',
      highlightBackground: '#2d333b',
      highlightGutterBackground: '#21262d',
      codeFoldBackground: '#161b22',
      emptyLineBackground: '#0f1117',
      gutterColor: '#6e7681',
      addedGutterColor: '#3fb950',
      removedGutterColor: '#f85149',
      codeFoldContentColor: '#8b949e',
      diffViewerTitleBackground: '#161b22',
      diffViewerTitleColor: '#8b949e',
      diffViewerTitleBorderColor: '#30363d',
    },
  },
}

export default function DiffView({ sourceConfig, convertedConfig, onChange, vendorPair }) {
  const [tab, setTab] = useState('diff')
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(convertedConfig)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-1">
        {/* Tabs */}
        <div className="flex gap-0">
          {[
            { id: 'diff', label: 'Diff View' },
            { id: 'edit', label: 'Edit Converted' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px
                ${tab === id
                  ? 'border-accent-blue text-text-primary'
                  : 'border-transparent text-text-muted hover:text-text-secondary'
                }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Labels + copy */}
        <div className="flex items-center gap-4">
          {tab === 'diff' && (
            <>
              <span className="text-xs text-text-muted flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-accent-red/60 inline-block" />
                {vendorPair?.source?.shortName ?? 'Original'}
              </span>
              <span className="text-xs text-text-muted flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-accent-green/60 inline-block" />
                {vendorPair?.target?.shortName ?? 'Converted'}
              </span>
            </>
          )}
          <button
            className="btn-ghost text-xs py-1 px-2"
            onClick={handleCopy}
          >
            {copied ? '✓ Copied' : 'Copy converted'}
          </button>
        </div>
      </div>

      {/* Content */}
      {tab === 'diff' ? (
        <div className="overflow-auto max-h-[480px] selectable text-xs">
          <ReactDiffViewer
            oldValue={sourceConfig}
            newValue={convertedConfig}
            splitView
            useDarkTheme
            compareMethod={DiffMethod.LINES}
            styles={DIFF_STYLES}
            leftTitle={vendorPair?.source?.shortName ?? 'Original'}
            rightTitle={vendorPair?.target?.shortName ?? 'Converted'}
            hideLineNumbers={false}
          />
        </div>
      ) : (
        <div className="h-[480px]">
          <Suspense fallback={<MonacoSkeleton />}>
            <MonacoEditor
              height="480px"
              language="plaintext"
              theme="vs-dark"
              value={convertedConfig}
              onChange={(val) => onChange(val ?? '')}
              options={{
                fontSize: 12,
                fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
                lineNumbers: 'on',
                wordWrap: 'off',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                renderLineHighlight: 'line',
                selectOnLineNumbers: true,
                tabSize: 2,
                padding: { top: 12, bottom: 12 },
              }}
            />
          </Suspense>
        </div>
      )}
    </div>
  )
}

function MonacoSkeleton() {
  return (
    <div className="h-[480px] bg-[#1e1e1e] flex items-center justify-center">
      <div className="text-text-muted text-sm animate-pulse-subtle">Loading editor…</div>
    </div>
  )
}
