// ── Products ──────────────────────────────────────────────────────────────────
// Each product is a specific OS/platform that can be a source, target, or both.
// The `id` is stored in Supabase and used for training example matching.

export const PRODUCTS = {
  // ── Cisco ─────────────────────────────────────────────────────────────────
  cisco_ios: {
    id: 'cisco_ios',
    name: 'IOS Switch',
    fullName: 'Cisco IOS',
    vendor: 'Cisco',
    vendorId: 'cisco',
    color: '#1ba0d7',
    description: 'Classic IOS (pre-XE) Catalyst switches',
    role: 'source',
  },
  cisco_ios_xe: {
    id: 'cisco_ios_xe',
    name: 'IOS-XE Switch',
    fullName: 'Cisco IOS-XE',
    vendor: 'Cisco',
    vendorId: 'cisco',
    color: '#1ba0d7',
    description: 'Catalyst 9000, 3850 series',
    role: 'both',
  },
  cisco_nxos: {
    id: 'cisco_nxos',
    name: 'NX-OS',
    fullName: 'Cisco NX-OS',
    vendor: 'Cisco',
    vendorId: 'cisco',
    color: '#1ba0d7',
    description: 'Nexus datacenter switches',
    role: 'both',
  },
  cisco_iosxr: {
    id: 'cisco_iosxr',
    name: 'IOS-XR',
    fullName: 'Cisco IOS-XR',
    vendor: 'Cisco',
    vendorId: 'cisco',
    color: '#1ba0d7',
    description: 'Service provider routers',
    role: 'source',
  },
  cisco_wlc: {
    id: 'cisco_wlc',
    name: 'WLC',
    fullName: 'Cisco WLC',
    vendor: 'Cisco',
    vendorId: 'cisco',
    color: '#1ba0d7',
    description: 'Wireless LAN Controller',
    role: 'source',
  },

  // ── Huawei ────────────────────────────────────────────────────────────────
  huawei_vrp: {
    id: 'huawei_vrp',
    name: 'VRP',
    fullName: 'Huawei VRP',
    vendor: 'Huawei',
    vendorId: 'huawei',
    color: '#e60012',
    description: 'S-series switches (VRP platform)',
    role: 'source',
  },
  huawei_comware: {
    id: 'huawei_comware',
    name: 'Comware',
    fullName: 'Huawei Comware',
    vendor: 'Huawei',
    vendorId: 'huawei',
    color: '#e60012',
    description: 'HPE/H3C Comware based',
    role: 'source',
  },

  // ── Fortinet ──────────────────────────────────────────────────────────────
  fortinet_fortiswitch: {
    id: 'fortinet_fortiswitch',
    name: 'FortiSwitch',
    fullName: 'Fortinet FortiSwitch',
    vendor: 'Fortinet',
    vendorId: 'fortinet',
    color: '#ee3124',
    description: 'FortiSwitch managed switches',
    role: 'both',
  },
  fortinet_fortigate: {
    id: 'fortinet_fortigate',
    name: 'FortiGate',
    fullName: 'Fortinet FortiGate',
    vendor: 'Fortinet',
    vendorId: 'fortinet',
    color: '#ee3124',
    description: 'FortiGate firewall/router',
    role: 'source',
  },

  // ── Palo Alto ─────────────────────────────────────────────────────────────
  paloalto_panos: {
    id: 'paloalto_panos',
    name: 'PAN-OS',
    fullName: 'Palo Alto PAN-OS',
    vendor: 'Palo Alto',
    vendorId: 'paloalto',
    color: '#fa582d',
    description: 'PAN-OS firewalls',
    role: 'source',
  },

  // ── Aruba / HPE ───────────────────────────────────────────────────────────
  aruba_aos_cx: {
    id: 'aruba_aos_cx',
    name: 'AOS-CX',
    fullName: 'Aruba AOS-CX',
    vendor: 'Aruba',
    vendorId: 'aruba',
    color: '#ff8300',
    description: '6000/8000 series CX switches',
    role: 'target',
  },
  aruba_aos_switch: {
    id: 'aruba_aos_switch',
    name: 'AOS-Switch',
    fullName: 'Aruba AOS-Switch',
    vendor: 'Aruba',
    vendorId: 'aruba',
    color: '#ff8300',
    description: 'ProCurve based — 2930/3810',
    role: 'target',
  },
  aruba_comware: {
    id: 'aruba_comware',
    name: 'Comware',
    fullName: 'HPE Comware',
    vendor: 'Aruba',
    vendorId: 'aruba',
    color: '#ff8300',
    description: 'HPE Comware — 5130/5940',
    role: 'target',
  },
}

// ── Vendor groups (for UI grouping) ─────────────────────────────────────────

export const VENDOR_GROUPS = [
  {
    id: 'cisco',
    name: 'Cisco',
    color: '#1ba0d7',
    products: ['cisco_ios', 'cisco_ios_xe', 'cisco_nxos', 'cisco_iosxr', 'cisco_wlc'],
  },
  {
    id: 'huawei',
    name: 'Huawei',
    color: '#e60012',
    products: ['huawei_vrp', 'huawei_comware'],
  },
  {
    id: 'fortinet',
    name: 'Fortinet',
    color: '#ee3124',
    products: ['fortinet_fortiswitch', 'fortinet_fortigate'],
  },
  {
    id: 'paloalto',
    name: 'Palo Alto',
    color: '#fa582d',
    products: ['paloalto_panos'],
  },
  {
    id: 'aruba',
    name: 'Aruba / HPE',
    color: '#ff8300',
    products: ['aruba_aos_cx', 'aruba_aos_switch', 'aruba_comware'],
  },
]

// ── Derived exports ─────────────────────────────────────────────────────────

export const SOURCE_PRODUCTS = Object.values(PRODUCTS).filter((p) => p.role === 'source' || p.role === 'both')
export const TARGET_PRODUCTS = Object.values(PRODUCTS).filter((p) => p.role === 'target' || p.role === 'both')

export const SOURCE_GROUPS = VENDOR_GROUPS
  .map((g) => ({
    ...g,
    products: g.products.map((id) => PRODUCTS[id]).filter((p) => p.role === 'source' || p.role === 'both'),
  }))
  .filter((g) => g.products.length > 0)

export const TARGET_GROUPS = VENDOR_GROUPS
  .map((g) => ({
    ...g,
    products: g.products.map((id) => PRODUCTS[id]).filter((p) => p.role === 'target' || p.role === 'both'),
  }))
  .filter((g) => g.products.length > 0)

// Get compatible target products for a given source product
// For now, all targets are available for all sources
export function getTargets(sourceProductId) {
  return TARGET_PRODUCTS
}

// Backward compat — used by TrainingConfigs select dropdowns
export const VENDORS = PRODUCTS

// ── Merge custom vendors/products from Supabase ─────────────────────────────

const BUILTIN_VENDOR_IDS = new Set(VENDOR_GROUPS.map((g) => g.id))
const BUILTIN_PRODUCT_IDS = new Set(Object.keys(PRODUCTS))

/**
 * Merge custom vendors and products from Supabase into the built-in data.
 * Returns { allProducts, allGroups, sourceGroups, targetGroups }
 */
export function mergeCustomData(customVendors = [], customProducts = []) {
  // Merge products
  const allProducts = { ...PRODUCTS }
  for (const cp of customProducts) {
    allProducts[cp.product_id] = {
      id: cp.product_id,
      name: cp.name,
      fullName: cp.full_name,
      vendor: cp.vendor_name ?? cp.vendor_id,
      vendorId: cp.vendor_id,
      color: cp.color ?? '#888888',
      description: cp.description ?? '',
      role: cp.role ?? 'both',
      isCustom: true,
    }
  }

  // Merge vendor groups
  const allGroups = [...VENDOR_GROUPS]
  for (const cv of customVendors) {
    if (!BUILTIN_VENDOR_IDS.has(cv.vendor_id)) {
      const products = customProducts
        .filter((p) => p.vendor_id === cv.vendor_id)
        .map((p) => p.product_id)
      allGroups.push({
        id: cv.vendor_id,
        name: cv.name,
        color: cv.color ?? '#888888',
        products,
        isCustom: true,
      })
    } else {
      // Add custom products to existing vendor group
      const existing = allGroups.find((g) => g.id === cv.vendor_id)
      if (existing) {
        const newProductIds = customProducts
          .filter((p) => p.vendor_id === cv.vendor_id)
          .map((p) => p.product_id)
        existing.products = [...existing.products, ...newProductIds]
      }
    }
  }

  const sourceGroups = allGroups
    .map((g) => ({
      ...g,
      products: g.products.map((id) => allProducts[id]).filter((p) => p && (p.role === 'source' || p.role === 'both')),
    }))
    .filter((g) => g.products.length > 0)

  const targetGroups = allGroups
    .map((g) => ({
      ...g,
      products: g.products.map((id) => allProducts[id]).filter((p) => p && (p.role === 'target' || p.role === 'both')),
    }))
    .filter((g) => g.products.length > 0)

  return { allProducts, allGroups, sourceGroups, targetGroups }
}

export { BUILTIN_VENDOR_IDS, BUILTIN_PRODUCT_IDS }
