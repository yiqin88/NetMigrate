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
 * Detect vendor/product from a config text snippet.
 * Returns { vendor, product, productId, confidence }
 */
export async function detectConfigVendor(configText) {
  const apiKey = getApiKey()
  if (!apiKey) return { vendor: null, product: null, productId: null, confidence: 'low' }

  console.log('[claude] detectConfigVendor')
  try {
    const { status, body } = await httpsPost(apiKey, {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: `You identify network device vendors and products from configuration text.
Respond ONLY with JSON: { "vendor": "string", "product": "string", "productId": "string", "confidence": "high|medium|low" }

Known productId values: cisco_ios, cisco_ios_xe, cisco_nxos, cisco_iosxr, cisco_wlc, huawei_vrp, huawei_comware, fortinet_fortiswitch, fortinet_fortigate, paloalto_panos, aruba_aos_cx, aruba_aos_switch, aruba_comware

Pick the closest matching productId. If unsure, use confidence "low".`,
      messages: [{ role: 'user', content: `Identify the vendor and product:\n\`\`\`\n${configText.slice(0, 2000)}\n\`\`\`` }],
    }, 15_000)

    if (status < 200 || status >= 300) return { vendor: null, product: null, productId: null, confidence: 'low' }

    const text = body.content?.[0]?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { vendor: null, product: null, productId: null, confidence: 'low' }

    const result = JSON.parse(jsonMatch[0])
    console.log('[claude] Detected:', result)
    return result
  } catch (err) {
    console.error('[claude] detectConfigVendor error:', err.message)
    return { vendor: null, product: null, productId: null, confidence: 'low' }
  }
}

const CATEGORIES = ['vlan', 'interface', 'routing', 'aaa', 'stp', 'lag', 'other']

/**
 * Analyse uploaded documentation and extract command mappings for one category.
 */
export async function analyseDocuments({ sourceDoc, targetDoc, sourceProduct, targetProduct, category }, onProgress) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('API key not configured.')

  console.log(`[claude] analyseDocuments: ${category} (${sourceProduct} → ${targetProduct})`)
  if (onProgress) onProgress({ category, status: 'processing' })

  try {
    const { status, body } = await httpsPost(apiKey, {
      model: MODEL,
      max_tokens: 4096,
      system: `You extract CLI command mappings between network platforms from documentation.
Category: ${category.toUpperCase()}
Source platform: ${sourceProduct}
Target platform: ${targetProduct}

You MUST respond with ONLY valid JSON in this exact format (no markdown, no explanation, no code fences):
{"mappings":[{"source_command":"command with X as variable","target_command":"equivalent","confidence":"high","notes":"explanation"}]}

Use X, Y, Z as variable placeholders. Only include ${category} commands.
confidence must be one of: high, medium, low
If no mappings found, return: {"mappings":[]}`,
      messages: [{
        role: 'user',
        content: `Extract ${category} command mappings from these docs.\n\nSOURCE (${sourceProduct}):\n${sourceDoc.slice(0, 8000)}\n\n---\n\nTARGET (${targetProduct}):\n${targetDoc.slice(0, 8000)}`
      }],
    }, 90_000)

    if (status < 200 || status >= 300) {
      console.error(`[claude] analyseDocuments ${category} failed: status=${status}`, JSON.stringify(body?.error ?? body).slice(0, 500))
      if (onProgress) onProgress({ category, status: 'error', error: `API ${status}` })
      return []
    }

    const text = body.content?.[0]?.text ?? ''
    console.log(`[claude] analyseDocuments ${category} raw response (${text.length} chars):`, text.slice(0, 300))

    const mappings = extractMappingsFromText(text)
    console.log(`[claude] analyseDocuments ${category}: ${mappings.length} mappings extracted`)
    if (onProgress) onProgress({ category, status: 'done', count: mappings.length })
    return mappings
  } catch (err) {
    console.error(`[claude] analyseDocuments ${category} error:`, err.message)
    if (onProgress) onProgress({ category, status: 'error', error: err.message })
    return []
  }
}

/**
 * Generate command mappings for one category using Claude's built-in knowledge.
 */
export async function analyseWebSearch({ sourceProduct, targetProduct, category }, onProgress) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('API key not configured.')

  console.log(`[claude] analyseWebSearch: ${category} (${sourceProduct} → ${targetProduct})`)
  if (onProgress) onProgress({ category, status: 'processing' })

  try {
    const { status, body } = await httpsPost(apiKey, {
      model: MODEL,
      max_tokens: 4096,
      system: `You are a network engineering expert with comprehensive knowledge of CLI command references for all major network vendors.

Generate a complete mapping of ${category.toUpperCase()} CLI commands between:
Source: ${sourceProduct}
Target: ${targetProduct}

You MUST respond with ONLY valid JSON in this exact format (no markdown, no code fences, no explanation before or after):
{"mappings":[{"source_command":"command with X as variable","target_command":"equivalent","confidence":"high","notes":"explanation"}],"sources":["reference used"],"unmappable":["commands with no equivalent"]}

Use X, Y, Z as variable placeholders for configurable values like VLAN IDs, IP addresses, interface numbers.
Focus ONLY on ${category} commands. Be comprehensive — include all common commands for this category.
confidence: high = exact equivalent exists, medium = close equivalent with caveats, low = approximate or partial match.`,
      messages: [{
        role: 'user',
        content: `Generate all ${category} command mappings from ${sourceProduct} to ${targetProduct}. Include every common ${category} CLI command used in production configurations.`
      }],
    }, 90_000)

    if (status < 200 || status >= 300) {
      console.error(`[claude] analyseWebSearch ${category} failed: status=${status}`, JSON.stringify(body?.error ?? body).slice(0, 500))
      if (onProgress) onProgress({ category, status: 'error', error: `API ${status}` })
      return { mappings: [], sources: [], unmappable: [] }
    }

    const text = body.content?.[0]?.text ?? ''
    console.log(`[claude] analyseWebSearch ${category} raw response (${text.length} chars):`, text.slice(0, 500))

    // Try to parse the full response as JSON first
    let result = { mappings: [], sources: [], unmappable: [] }
    try {
      // Strip markdown code fences if present
      let jsonStr = text.trim()
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
      }

      // Try parsing the whole thing
      const parsed = JSON.parse(jsonStr)
      if (parsed.mappings) {
        result = parsed
      } else if (Array.isArray(parsed)) {
        result.mappings = parsed
      }
    } catch (e1) {
      console.log(`[claude] ${category} full parse failed, trying regex extraction...`)
      // Fallback: extract JSON object with regex
      try {
        // Find the outermost { ... } that contains "mappings"
        const objMatch = text.match(/\{[^{}]*"mappings"\s*:\s*\[[\s\S]*?\]\s*(?:,[^{}]*)?\}/s)
        if (objMatch) {
          const parsed = JSON.parse(objMatch[0])
          result = { mappings: parsed.mappings ?? [], sources: parsed.sources ?? [], unmappable: parsed.unmappable ?? [] }
        } else {
          // Try to find just an array
          const arrMatch = text.match(/\[\s*\{[\s\S]*?\}\s*\]/)
          if (arrMatch) {
            result.mappings = JSON.parse(arrMatch[0])
          } else {
            console.error(`[claude] ${category} JSON extraction failed. Raw text:`, text.slice(0, 1000))
          }
        }
      } catch (e2) {
        console.error(`[claude] ${category} regex parse also failed:`, e2.message)
        console.error(`[claude] ${category} raw text:`, text.slice(0, 1000))
      }
    }

    const mappings = Array.isArray(result.mappings) ? result.mappings : []
    console.log(`[claude] analyseWebSearch ${category}: ${mappings.length} mappings, ${(result.unmappable ?? []).length} unmappable`)
    if (onProgress) onProgress({ category, status: 'done', count: mappings.length })
    return {
      mappings,
      sources: Array.isArray(result.sources) ? result.sources : [],
      unmappable: Array.isArray(result.unmappable) ? result.unmappable : [],
    }
  } catch (err) {
    console.error(`[claude] analyseWebSearch ${category} error:`, err.message)
    if (onProgress) onProgress({ category, status: 'error', error: err.message })
    return { mappings: [], sources: [], unmappable: [] }
  }
}

/**
 * Extract mappings array from Claude response text with multiple fallback strategies.
 */
function extractMappingsFromText(text) {
  // Strategy 1: Strip code fences, parse as JSON with "mappings" key
  try {
    let jsonStr = text.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    }
    const parsed = JSON.parse(jsonStr)
    if (parsed.mappings && Array.isArray(parsed.mappings)) return parsed.mappings
    if (Array.isArray(parsed)) return parsed
  } catch { /* continue */ }

  // Strategy 2: Find JSON array in text
  try {
    const arrMatch = text.match(/\[\s*\{[\s\S]*?\}\s*\]/)
    if (arrMatch) {
      const arr = JSON.parse(arrMatch[0])
      if (Array.isArray(arr)) return arr
    }
  } catch { /* continue */ }

  // Strategy 3: Find object with mappings key
  try {
    const objMatch = text.match(/\{[^{}]*"mappings"\s*:\s*\[[\s\S]*?\]\s*(?:,[^{}]*)?\}/s)
    if (objMatch) {
      const obj = JSON.parse(objMatch[0])
      if (Array.isArray(obj.mappings)) return obj.mappings
    }
  } catch { /* continue */ }

  console.error('[claude] extractMappingsFromText failed. Raw:', text.slice(0, 500))
  return []
}

export { CATEGORIES }

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
export async function convertConfig({ sourceConfig, sourceVendor, targetVendor, examples = [], kbMappings = [] }, onProgress) {
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
  const userPrompt = buildUserPrompt(sourceConfig, sourceVendor, targetVendor, examples, kbMappings)

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
  const srcType = sourceVendor.deviceType ?? 'switch'
  const tgtLabel = targetVendor.fullName ?? targetVendor.name
  const tgtDesc = targetVendor.description ?? ''
  const tgtType = targetVendor.deviceType ?? 'switch'

  return `You are an expert network engineer specializing in migrating device configurations between vendors.

Source platform: ${srcLabel} (${srcDesc}) — Device type: ${srcType}
Target platform: ${tgtLabel} (${tgtDesc}) — Device type: ${tgtType}

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

function buildUserPrompt(sourceConfig, sourceVendor, targetVendor, examples, kbMappings = []) {
  let prompt = ''

  // Knowledge base mappings (highest priority — human-verified)
  if (kbMappings.length > 0) {
    prompt += `## Authoritative Command Mappings (${kbMappings.length} verified)\n`
    prompt += `Use these as authoritative reference — they take priority over general knowledge.\n\n`
    prompt += `| Source Command | Target Command | Category |\n`
    prompt += `|---|---|---|\n`
    kbMappings.slice(0, 100).forEach((m) => {
      prompt += `| ${m.source_command} | ${m.target_command} | ${m.category} |\n`
    })
    prompt += '\n---\n\n'
  }

  // Learning examples
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
