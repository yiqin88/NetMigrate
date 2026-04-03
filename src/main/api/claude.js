// Main-process Claude API service — all Anthropic API calls go through here
// Uses Node.js https module for maximum compatibility

import https from 'https'
import { getSetting } from '../settings'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 8192
const TIMEOUT_MS = 60_000
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

/**
 * Make an HTTPS POST request to the Anthropic API using Node's https module.
 * Returns a Promise that resolves to { status, body }.
 */
function httpsPost(apiKey, bodyObj, timeoutMs = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(bodyObj)

    console.log(`[claude] HTTPS POST https://${API_HOST}${API_PATH}`)
    console.log(`[claude] Headers: x-api-key=${maskKey(apiKey)}, anthropic-version=2023-06-01`)
    console.log(`[claude] Payload size: ${payload.length} bytes`)

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
        console.log(`[claude] Response status: ${res.statusCode}`)
        console.log(`[claude] Response size: ${raw.length} bytes`)
        try {
          const body = JSON.parse(raw)
          resolve({ status: res.statusCode, body })
        } catch {
          console.error('[claude] Failed to parse response JSON, raw:', raw.slice(0, 500))
          reject(new Error(`Invalid JSON response (status ${res.statusCode})`))
        }
      })
    })

    req.on('timeout', () => {
      console.error(`[claude] Request timed out after ${timeoutMs}ms`)
      req.destroy()
      reject(new Error(`Request timed out after ${timeoutMs / 1000} seconds.`))
    })

    req.on('error', (err) => {
      console.error('[claude] Request error:', {
        message: err.message,
        code: err.code,
        errno: err.errno,
        syscall: err.syscall,
      })
      reject(new Error(`Network error: ${err.message} (code: ${err.code ?? 'unknown'})`))
    })

    req.write(payload)
    req.end()
  })
}

/**
 * Validate an API key with a minimal API call.
 */
export async function testApiKey(apiKey) {
  console.log('[claude] testApiKey called, key:', maskKey(apiKey))

  if (!apiKey || !apiKey.startsWith('sk-')) {
    return { valid: false, error: 'API key must start with "sk-"' }
  }

  try {
    const { status, body } = await httpsPost(apiKey, {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4,
      messages: [{ role: 'user', content: 'Hi' }],
    }, 15_000)

    console.log('[claude] testApiKey response status:', status)

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
 * Convert a network config using Claude.
 */
export async function convertConfig({ sourceConfig, sourceVendor, targetVendor, examples = [] }) {
  const apiKey = getApiKey()
  console.log('[claude] convertConfig — API key:', maskKey(apiKey))
  if (!apiKey) throw new Error('Anthropic API key not configured. Go to Settings to add it.')

  if (sourceConfig.length > MAX_CONFIG_CHARS) {
    throw new Error(
      `Config is too large (${(sourceConfig.length / 1000).toFixed(0)}K chars). ` +
      `Maximum supported is ${MAX_CONFIG_CHARS / 1000}K characters.`
    )
  }

  const systemPrompt = buildSystemPrompt(sourceVendor, targetVendor)
  const userPrompt = buildUserPrompt(sourceConfig, sourceVendor, targetVendor, examples)

  console.log('[claude] Converting — config:', sourceConfig.length, 'chars, examples:', examples.length)

  const { status, body } = await httpsPost(apiKey, {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  if (status < 200 || status >= 300) {
    let errorMessage = `API error ${status}`
    if (body?.error?.message) errorMessage = body.error.message
    if (status === 401) errorMessage = 'Invalid API key. Check your Anthropic API key in Settings.'
    else if (status === 429) errorMessage = 'Rate limited — too many requests. Wait a moment and try again.'
    else if (status === 529) errorMessage = 'Anthropic API is overloaded. Try again in a few seconds.'
    throw new Error(errorMessage)
  }

  const text = body.content?.[0]?.text ?? ''
  console.log('[claude] Response text length:', text.length)
  if (!text) throw new Error('Claude returned an empty response. Try again.')

  return parseConversionResponse(text)
}

function buildSystemPrompt(sourceVendor, targetVendor) {
  return `You are an expert network engineer specializing in migrating device configurations between vendors.

Your task is to convert ${sourceVendor.name} configuration syntax to equivalent ${targetVendor.name} syntax.

Rules:
1. Preserve all logical functionality — VLANs, routing, switching behaviour must be equivalent
2. Use ${targetVendor.name} native syntax and best practices
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
