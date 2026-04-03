// Main-process Claude API service — all Anthropic API calls go through here
// This avoids CSP/CORS issues in the Electron renderer process

import { net } from 'electron'
import { getSetting } from '../settings'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 8192
const TIMEOUT_MS = 60_000
const MAX_CONFIG_CHARS = 200_000

function getApiKey() {
  return getSetting('__safe_anthropic_api_key') ?? null
}

/**
 * Make a request to the Anthropic Messages API using Electron's net module.
 * net.fetch() respects the app's session and bypasses renderer CSP restrictions.
 */
async function anthropicFetch(apiKey, body, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await net.fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    return response
  } catch (err) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000} seconds.`)
    }
    throw new Error(`Network error: ${err.message}. Check your internet connection.`)
  }
}

/**
 * Validate an API key with a minimal API call.
 */
export async function testApiKey(apiKey) {
  if (!apiKey || !apiKey.startsWith('sk-')) {
    return { valid: false, error: 'API key must start with "sk-"' }
  }

  try {
    const response = await anthropicFetch(apiKey, {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4,
      messages: [{ role: 'user', content: 'Hi' }],
    }, 15_000)

    if (response.ok) return { valid: true }
    if (response.status === 401) return { valid: false, error: 'Invalid API key' }
    if (response.status === 403) return { valid: false, error: 'API key lacks permissions' }

    const body = await response.json().catch(() => ({}))
    return { valid: false, error: body?.error?.message ?? `API error ${response.status}` }
  } catch (err) {
    return { valid: false, error: err.message }
  }
}

/**
 * Convert a network config using Claude.
 */
export async function convertConfig({ sourceConfig, sourceVendor, targetVendor, examples = [] }) {
  const apiKey = getApiKey()
  console.log('[claude] convertConfig — API key:', apiKey ? `${apiKey.slice(0, 8)}…` : 'NULL')
  if (!apiKey) throw new Error('Anthropic API key not configured. Go to Settings to add it.')

  if (sourceConfig.length > MAX_CONFIG_CHARS) {
    throw new Error(
      `Config is too large (${(sourceConfig.length / 1000).toFixed(0)}K chars). ` +
      `Maximum supported is ${MAX_CONFIG_CHARS / 1000}K characters. ` +
      `Try splitting the config into smaller sections.`
    )
  }

  const systemPrompt = buildSystemPrompt(sourceVendor, targetVendor)
  const userPrompt = buildUserPrompt(sourceConfig, sourceVendor, targetVendor, examples)

  console.log('[claude] Making API call — config:', sourceConfig.length, 'chars, examples:', examples.length)

  const response = await anthropicFetch(apiKey, {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  console.log('[claude] Response status:', response.status)

  if (!response.ok) {
    let errorMessage = `API error ${response.status}`
    try {
      const body = await response.json()
      errorMessage = body?.error?.message ?? errorMessage
      if (response.status === 401) errorMessage = 'Invalid API key. Check your Anthropic API key in Settings.'
      else if (response.status === 429) errorMessage = 'Rate limited — too many requests. Wait a moment and try again.'
      else if (response.status === 529) errorMessage = 'Anthropic API is overloaded. Try again in a few seconds.'
    } catch { /* use status-based message */ }
    throw new Error(errorMessage)
  }

  let result
  try {
    result = await response.json()
  } catch {
    throw new Error('Failed to parse API response.')
  }

  const text = result.content?.[0]?.text ?? ''
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
