import { useState, useRef, useEffect } from 'react'
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued'

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
  const textareaRef = useRef(null)

  // Auto-focus textarea when switching to edit tab
  useEffect(() => {
    if (tab === 'edit' && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [tab])

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
        <div className="relative">
          <div className="absolute top-2 right-3 flex items-center gap-2 z-10">
            <span className="text-xs text-text-muted">
              {convertedConfig.split('\n').length} lines
            </span>
          </div>
          <textarea
            ref={textareaRef}
            className="w-full h-[480px] bg-surface font-mono text-xs text-text-primary
              p-4 resize-none focus:outline-none selectable leading-relaxed
              border-none"
            value={convertedConfig}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
          />
        </div>
      )}
    </div>
  )
}
