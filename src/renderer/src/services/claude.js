// Claude API service for config conversion
// API key is retrieved from Electron safeStorage at call time

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 8192
const TIMEOUT_MS = 60_000
const MAX_CONFIG_CHARS = 200_000 // ~200 KB — guard against huge configs

export async function convertConfig({ sourceConfig, sourceVendor, targetVendor, examples = [] }) {
  const apiKey = await window.electronAPI?.safeStore.get('anthropic_api_key')
  if (!apiKey) throw new Error('Anthropic API key not configured. Go to Settings to add it.')

  // Guard: reject excessively large configs before sending
  if (sourceConfig.length > MAX_CONFIG_CHARS) {
    throw new Error(
      `Config is too large (${(sourceConfig.length / 1000).toFixed(0)}K chars). ` +
      `Maximum supported is ${MAX_CONFIG_CHARS / 1000}K characters. ` +
      `Try splitting the config into smaller sections.`
    )
  }

  const systemPrompt = buildSystemPrompt(sourceVendor, targetVendor)
  const userPrompt = buildUserPrompt(sourceConfig, sourceVendor, targetVendor, examples)

  // Abort controller for 60-second timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let response
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      throw new Error(
        'Conversion timed out after 60 seconds. The config may be too large, ' +
        'or the API is experiencing high load. Try again or reduce the config size.'
      )
    }
    // Network error
    throw new Error(`Network error: ${err.message}. Check your internet connection.`)
  }
  clearTimeout(timeoutId)

  if (!response.ok) {
    let errorMessage = `API error ${response.status}`
    try {
      const body = await response.json()
      errorMessage = body?.error?.message ?? errorMessage

      if (response.status === 401) {
        errorMessage = 'Invalid API key. Check your Anthropic API key in Settings.'
      } else if (response.status === 429) {
        errorMessage = 'Rate limited — too many requests. Wait a moment and try again.'
      } else if (response.status === 529) {
        errorMessage = 'Anthropic API is overloaded. Try again in a few seconds.'
      }
    } catch {
      // Couldn't parse error body — use status-based message
    }
    throw new Error(errorMessage)
  }

  let result
  try {
    result = await response.json()
  } catch {
    throw new Error('Failed to parse API response. The response was not valid JSON.')
  }

  const text = result.content?.[0]?.text ?? ''
  if (!text) {
    throw new Error('Claude returned an empty response. Try again.')
  }

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

  prompt += `## Config to Convert\n`
  prompt += `Source: ${sourceVendor.name}\n`
  prompt += `Target: ${targetVendor.name}\n\n`
  prompt += `\`\`\`\n${sourceConfig}\n\`\`\``

  return prompt
}

function parseConversionResponse(text) {
  // Extract JSON block if wrapped in markdown
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/)
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim()

  try {
    return JSON.parse(jsonStr)
  } catch {
    // Fallback: treat entire response as raw config
    return {
      config: text,
      warnings: [{ severity: 'INFO', message: 'Response was not structured JSON — showing raw output', original: '' }],
      summary: { vlans: 0, interfaces: 0, routingProtocols: [], portChannels: 0 },
    }
  }
}
