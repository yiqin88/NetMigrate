export const VENDORS = {
  CISCO_IOS: {
    id: 'cisco_ios',
    name: 'Cisco IOS / IOS-XE',
    shortName: 'Cisco IOS',
    vendor: 'Cisco',
    category: 'switch',
    color: '#1ba0d7',
    features: ['VLANs', 'Switchport', 'OSPF', 'Static Routes', 'DHCP Helper', 'STP', 'Port-Channels'],
    configKeywords: ['interface', 'vlan', 'ip address', 'spanning-tree', 'router ospf'],
    description: 'Cisco Catalyst / IOS-XE switches',
  },
  ARUBA_CX: {
    id: 'aruba_cx',
    name: 'Aruba CX',
    shortName: 'Aruba CX',
    vendor: 'Aruba / HPE',
    category: 'switch',
    color: '#ff8300',
    features: ['VLANs', 'Switchport', 'OSPF', 'Static Routes', 'DHCP Helper', 'MSTP', 'LAG'],
    configKeywords: ['interface', 'vlan', 'ip address', 'spanning-tree', 'router ospf'],
    description: 'Aruba CX 6x00 / 8x00 series switches',
  },
}

// Valid source → target migration pairs
export const MIGRATION_PAIRS = [
  {
    source: VENDORS.CISCO_IOS,
    target: VENDORS.ARUBA_CX,
    label: 'Cisco IOS → Aruba CX',
    supported: true,
  },
]

// For populating the source selector (only vendors we can migrate FROM)
export const SOURCE_VENDORS = MIGRATION_PAIRS.map((p) => p.source)

// Given a source vendor, return available targets
export function getTargets(sourceId) {
  return MIGRATION_PAIRS
    .filter((p) => p.source.id === sourceId && p.supported)
    .map((p) => p.target)
}
