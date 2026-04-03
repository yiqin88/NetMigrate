// Main-process Claude API service — all Anthropic API calls go through here
// Uses Node.js https module with SSE streaming for real-time progress

import https from 'https'
import { getSetting } from '../settings'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 8192
const TIMEOUT_MS = 120_000
const MAX_CONFIG_CHARS = 200_000
const API_HOST = 'api.anthropic.com'
const API_PATH = '/v1/messages'

function getApiKey() {
  return getSetting('__safe_anthropic_api_key') ?? null
}

function maskKey(key) {
  if (!key || key.length < 8) return '(empty)'
  return `${key.slice(0, 6)}…${key.slice(-4)}`
}

// ── Non-streaming POST (for testApiKey) ───────────────────────────────────────

function httpsPost(apiKey, bodyObj, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(bodyObj)

    const options = {
      hostname: API_HOST,
      port: 443,
      path: API_PATH,
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      },
      timeout: timeoutMs,
    }

    const req = https.request(options, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8')
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) })
        } catch {
          reject(new Error(`Invalid JSON response (status ${res.statusCode})`))
        }
      })
    })

    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out.')) })
    req.on('error', (err) => reject(new Error(`Network error: ${err.message} (${err.code ?? 'unknown'})`)))
    req.write(payload)
    req.end()
  })
}

// ── Streaming POST (for convertConfig) ────────────────────────────────────��───

/**
 * Make a streaming HTTPS POST to the Anthropic API.
 * Parses SSE events and calls onDelta(text) for each text chunk.
 * Returns the full accumulated text when complete.
 */
function httpsPostStream(apiKey, bodyObj, onDelta, timeoutMs = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ ...bodyObj, stream: true })

    console.log(`[claude] Streaming POST https://${API_HOST}${API_PATH}`)
    console.log(`[claude] Key: ${maskKey(apiKey)}, payload: ${payload.length} bytes`)

    const options = {
      hostname: API_HOST,
      port: 443,
      path: API_PATH,
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      },
      timeout: timeoutMs,
    }

    const req = https.request(options, (res) => {
      console.log(`[claude] Stream response status: ${res.statusCode}`)

      // Non-200: collect full body and reject
      if (res.statusCode < 200 || res.statusCode >= 300) {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8')
          let msg = `API error ${res.statusCode}`
          try {
            const body = JSON.parse(raw)
            msg = body?.error?.message ?? msg
          } catch { /* use default */ }
          if (res.statusCode === 401) msg = 'Invalid API key. Check Settings.'
          else if (res.statusCode === 429) msg = 'Rate limited. Wait a moment and try again.'
          else if (res.statusCode === 529) msg = 'Anthropic API overloaded. Try again shortly.'
          reject(new Error(msg))
        })
        return
      }

      // 200 OK — parse SSE stream
      let fullText = ''
      let buffer = ''

      res.setEncoding('utf-8')
      res.on('data', (chunk) => {
        buffer += chunk
        // Process complete SSE events (delimited by double newlines)
        const events = buffer.split('\n\n')
        buffer = events.pop() // keep incomplete event in buffer

        for (const event of events) {
          const lines = event.split('\n')
          let eventType = ''
          let dataStr = ''

          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7)
            else if (line.startsWith('data: ')) dataStr = line.slice(6)
          }

          if (eventType === 'content_block_delta' && dataStr) {
            try {
              const data = JSON.parse(dataStr)
              if (data.delta?.type === 'text_delta' && data.delta.text) {
                fullText += data.delta.text
                onDelta(data.delta.text, fullText.length)
              }
            } catch { /* skip malformed event */ }
          }

          if (eventType === 'error' && dataStr) {
            try {
              const data = JSON.parse(dataStr)
              reject(new Error(data.error?.message ?? 'Stream error'))
              return
            } catch { /* skip */ }
          }
        }
      })

      res.on('end', () => {
        console.log(`[claude] Stream complete — ${fullText.length} chars`)
        resolve(fullText)
      })

      res.on('error', (err) => {
        reject(new Error(`Stream error: ${err.message}`))
      })
    })

    req.on('timeout', () => {
      console.error(`[claude] Stream timed out after ${timeoutMs}ms`)
      req.destroy()
      reject(new Error(`Request timed out after ${timeoutMs / 1000} seconds.`))
    })

    req.on('error', (err) => {
      console.error('[claude] Request error:', err.message, err.code)
      reject(new Error(`Network error: ${err.message} (${err.code ?? 'unknown'})`))
    })

    req.write(payload)
    req.end()
  })
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function testApiKey(apiKey) {
  console.log('[claude] testApiKey, key:', maskKey(apiKey))
  if (!apiKey || !apiKey.startsWith('sk-')) {
    return { valid: false, error: 'API key must start with "sk-"' }
  }

  try {
    const { status, body } = await httpsPost(apiKey, {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4,
      messages: [{ role: 'user', content: 'Hi' }],
    })
    console.log('[claude] testApiKey status:', status)
    if (status >= 200 && status < 300) return { valid: true }
    if (status === 401) return { valid: false, error: 'Invalid API key' }
    if (status === 403) return { valid: false, error: 'API key lacks permissions' }
    return { valid: false, error: body?.error?.message ?? `API error ${status}` }
  } catch (err) {
    console.error('[claude] testApiKey error:', err.message)
    return { valid: false, error: err.message }
  }
}

/**
 * Extract command translation rules from a source/converted config pair.
 * Uses Haiku for speed + cost efficiency.
 */
export async function extractCommandMappings({ sourceConfig, convertedConfig, sourceVendor, targetVendor }) {
  const apiKey = getApiKey()
  if (!apiKey) return []

  console.log('[claude] extractCommandMappings')

  try {
    const { status, body } = await httpsPost(apiKey, {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: `You extract command translation rules between network vendors. Given a source config and its converted equivalent, output a JSON array of translation rules.
Each rule: { "source": "<source command pattern>", "target": "<target equivalent>", "category": "<vlan|interface|routing|stp|acl|other>" }
Use X, Y, Z as variable placeholders. Only output the JSON array, no explanation.`,
      messages: [{
        role: 'user',
        content: `Source (${sourceVendor}):\n\`\`\`\n${sourceConfig.slice(0, 3000)}\n\`\`\`\n\nConverted (${targetVendor}):\n\`\`\`\n${convertedConfig.slice(0, 3000)}\n\`\`\``,
      }],
    }, 30_000)

    if (status < 200 || status >= 300) {
      console.error('[claude] extractCommandMappings failed:', status)
      return []
    }

    const text = body.content?.[0]?.text ?? ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    const mappings = JSON.parse(jsonMatch[0])
    console.log('[claude] Extracted', mappings.length, 'command mappings')
    return Array.isArray(mappings) ? mappings : []
  } catch (err) {
    console.error('[claude] extractCommandMappings error:', err.message)
    return []
  }
}

/**
 * Convert a config using Claude with streaming.
 * @param {Function} onProgress - called with { chars, text } as response streams in
 */
export async function convertConfig({ sourceConfig, sourceVendor, targetVendor, examples = [] }, onProgress) {
  const apiKey = getApiKey()
  console.log('[claude] convertConfig — key:', maskKey(apiKey), 'config:', sourceConfig.length, 'chars')
  if (!apiKey) throw new Error('Anthropic API key not configured. Go to Settings to add it.')

  if (sourceConfig.length > MAX_CONFIG_CHARS) {
    throw new Error(
      `Config is too large (${(sourceConfig.length / 1000).toFixed(0)}K chars). ` +
      `Maximum supported is ${MAX_CONFIG_CHARS / 1000}K characters.`
    )
  }

  const systemPrompt = buildSystemPrompt(sourceVendor, targetVendor)
  const userPrompt = buildUserPrompt(sourceConfig, sourceVendor, targetVendor, examples)

  const fullText = await httpsPostStream(
    apiKey,
    {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    },
    (deltaText, totalChars) => {
      if (onProgress) onProgress({ chars: totalChars })
    }
  )

  if (!fullText) throw new Error('Claude returned an empty response. Try again.')
  return parseConversionResponse(fullText)
}

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildSystemPrompt(sourceVendor, targetVendor) {
  const srcLabel = sourceVendor.fullName ?? sourceVendor.name
  const srcDesc = sourceVendor.description ?? ''
  const tgtLabel = targetVendor.fullName ?? targetVendor.name
  const tgtDesc = targetVendor.description ?? ''

  return `You are an expert network engineer specializing in migrating device configurations between vendors.

Source platform: ${srcLabel} (${srcDesc})
Target platform: ${tgtLabel} (${tgtDesc})

Your task is to convert ${srcLabel} configuration syntax to equivalent ${tgtLabel} syntax.

Rules:
1. Preserve all logical functionality — VLANs, routing, switching behaviour must be equivalent
2. Use ${tgtLabel} native syntax and best practices
3. If a feature cannot be directly mapped, add a WARNING comment explaining why
4. Output ONLY the converted configuration — no explanations outside the config
5. Format warnings as: # WARNING: <severity> - <explanation>
   where severity is CRITICAL, WARNING, or INFO

Return your response as JSON with this exact structure:
{
  "config": "<the full converted configuration>",
  "warnings": [
    { "severity": "CRITICAL|WARNING|INFO", "message": "<description>", "original": "<original line/block>" }
  ],
  "summary": {
    "vlans": <number>,
    "interfaces": <number>,
    "routingProtocols": ["list"],
    "portChannels": <number>
  }
}`
}

function buildUserPrompt(sourceConfig, sourceVendor, targetVendor, examples) {
  let prompt = ''
  if (examples.length > 0) {
    prompt += `## Learning Examples (${examples.length} past approved migrations)\n\n`
    examples.slice(0, 10).forEach((ex, i) => {
      prompt += `### Example ${i + 1}\n`
      prompt += `SOURCE:\n\`\`\`\n${ex.source_config.slice(0, 500)}\n\`\`\`\n`
      prompt += `CONVERTED:\n\`\`\`\n${ex.converted_config.slice(0, 500)}\n\`\`\`\n\n`
    })
    prompt += '---\n\n'
  }
  prompt += `## Config to Convert\nSource: ${sourceVendor.name}\nTarget: ${targetVendor.name}\n\n`
  prompt += `\`\`\`\n${sourceConfig}\n\`\`\``
  return prompt
}

function parseConversionResponse(text) {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/)
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim()
  try {
    const parsed = JSON.parse(jsonStr)
    console.log('[claude] Parsed — config:', parsed.config?.length ?? 0, 'chars, warnings:', parsed.warnings?.length ?? 0)
    return parsed
  } catch {
    return {
      config: text,
      warnings: [{ severity: 'INFO', message: 'Response was not structured JSON — showing raw output', original: '' }],
      summary: { vlans: 0, interfaces: 0, routingProtocols: [], portChannels: 0 },
    }
  }
}
