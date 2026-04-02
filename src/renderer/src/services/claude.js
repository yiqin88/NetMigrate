// Claude API service for config conversion
// API key is retrieved from Electron safeStorage at call time

const MODEL = 'claude-opus-4-6'
const MAX_TOKENS = 8192

export async function convertConfig({ sourceConfig, sourceVendor, targetVendor, examples = [] }) {
  const apiKey = await window.electronAPI?.safeStore.get('anthropic_api_key')
  if (!apiKey) throw new Error('Anthropic API key not configured. Go to Settings to add it.')

  const systemPrompt = buildSystemPrompt(sourceVendor, targetVendor)
  const userPrompt = buildUserPrompt(sourceConfig, sourceVendor, targetVendor, examples)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
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

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `API error ${response.status}`)
  }

  const result = await response.json()
  const text = result.content?.[0]?.text ?? ''
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
