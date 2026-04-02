// Cisco IOS config parser — extracts structured elements for preview

/**
 * Parse a Cisco IOS / IOS-XE configuration string into structured elements.
 * @param {string} configText
 * @returns {{ vlans, interfaces, routingProtocols, dhcpHelpers, portChannels, stpConfig }}
 */
export function parseCiscoConfig(configText) {
  const lines = configText.split('\n').map((l) => l.trimEnd())

  return {
    vlans: parseVlans(lines),
    interfaces: parseInterfaces(lines),
    routingProtocols: parseRoutingProtocols(lines),
    dhcpHelpers: parseDhcpHelpers(lines),
    portChannels: parsePortChannels(lines),
    stpConfig: parseStp(lines),
  }
}

function parseVlans(lines) {
  const vlans = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^vlan (\d+(?:,\d+)*)$/)
    if (!m) continue
    const ids = m[1].split(',')
    let name = null
    if (i + 1 < lines.length) {
      const nm = lines[i + 1].match(/^\s+name\s+(.+)$/)
      if (nm) name = nm[1]
    }
    ids.forEach((id) => vlans.push({ id: id.trim(), name }))
  }
  return vlans
}

function parseInterfaces(lines) {
  const interfaces = []
  let current = null
  for (const line of lines) {
    const ifMatch = line.match(/^interface\s+(.+)$/)
    if (ifMatch) {
      if (current) interfaces.push(current)
      current = { name: ifMatch[1], description: null, mode: null, vlan: null, trunk: null, ipAddress: null, shutdown: false }
      continue
    }
    if (!current) continue

    if (line.match(/^[^\s]/)) { current = null; continue }

    const desc = line.match(/^\s+description\s+(.+)$/)
    if (desc) { current.description = desc[1]; continue }

    if (line.match(/^\s+switchport mode access/)) { current.mode = 'access'; continue }
    if (line.match(/^\s+switchport mode trunk/)) { current.mode = 'trunk'; continue }

    const accessVlan = line.match(/^\s+switchport access vlan (\d+)/)
    if (accessVlan) { current.vlan = accessVlan[1]; continue }

    const trunkVlan = line.match(/^\s+switchport trunk allowed vlan (.+)/)
    if (trunkVlan) { current.trunk = trunkVlan[1]; continue }

    const ip = line.match(/^\s+ip address (\S+)\s+(\S+)/)
    if (ip) { current.ipAddress = `${ip[1]}/${maskToCidr(ip[2])}`; continue }

    if (line.match(/^\s+shutdown/)) { current.shutdown = true; continue }
  }
  if (current) interfaces.push(current)
  return interfaces
}

function parseRoutingProtocols(lines) {
  const protocols = []
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^router ospf/)) protocols.push({ type: 'OSPF', line: lines[i] })
    if (lines[i].match(/^router bgp/)) protocols.push({ type: 'BGP', line: lines[i] })
    if (lines[i].match(/^router eigrp/)) protocols.push({ type: 'EIGRP', line: lines[i] })
    if (lines[i].match(/^ip route /)) protocols.push({ type: 'Static', line: lines[i] })
  }
  return protocols
}

function parseDhcpHelpers(lines) {
  const helpers = []
  for (const line of lines) {
    const m = line.match(/^\s+ip helper-address\s+(\S+)/)
    if (m) helpers.push(m[1])
  }
  return [...new Set(helpers)]
}

function parsePortChannels(lines) {
  const pcs = []
  for (const line of lines) {
    const m = line.match(/^interface Port-channel(\d+)/)
    if (m) pcs.push({ id: m[1] })
  }
  return pcs
}

function parseStp(lines) {
  const stpLines = lines.filter((l) => l.match(/^spanning-tree/))
  return stpLines.length > 0 ? { enabled: true, lines: stpLines } : { enabled: false, lines: [] }
}

function maskToCidr(mask) {
  const parts = mask.split('.').map(Number)
  let cidr = 0
  for (const p of parts) {
    let n = p
    while (n > 0) { cidr += n & 1; n >>= 1 }
  }
  return cidr
}
