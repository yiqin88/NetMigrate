import { useState } from 'react'
import { useVendors } from '../../hooks/useVendors'
import { DEVICE_TYPES } from '../../constants/vendors'

export default function VendorManager() {
  const { allGroups, allProducts, builtinVendorIds, builtinProductIds, refresh } = useVendors()
  const [showAddVendor, setShowAddVendor] = useState(false)
  const [showAddProduct, setShowAddProduct] = useState(null) // vendor_id or null
  const [error, setError] = useState('')

  async function handleDeleteVendor(vendorId) {
    if (!confirm('Delete this vendor and all its products?')) return
    try {
      // Find the Supabase row id — for custom vendors, the vendor_id is stored
      const vendors = await window.electronAPI?.customVendors?.list() ?? []
      const row = vendors.find((v) => v.vendor_id === vendorId)
      if (row) await window.electronAPI.customVendors.delete(row.id)
      refresh()
    } catch (err) { setError(err.message) }
  }

  async function handleDeleteProduct(productId) {
    if (!confirm('Delete this product?')) return
    try {
      const products = await window.electronAPI?.customProducts?.list() ?? []
      const row = products.find((p) => p.product_id === productId)
      if (row) await window.electronAPI.customProducts.delete(row.id)
      refresh()
    } catch (err) { setError(err.message) }
  }

  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge color="#388bfd" label="V" />
          <h2 className="text-sm font-semibold text-text-primary">Manage Vendors & Products</h2>
        </div>
        <button className="btn-ghost text-xs" onClick={() => setShowAddVendor((s) => !s)}>
          {showAddVendor ? '← Cancel' : '+ Add Vendor'}
        </button>
      </div>

      <p className="text-xs text-text-muted">
        Built-in vendors are shown in grey. Custom vendors sync to Supabase and appear for all users.
      </p>

      {error && <p className="text-xs text-accent-red">{error}</p>}

      {showAddVendor && (
        <AddVendorForm onSaved={() => { setShowAddVendor(false); refresh() }} onCancel={() => setShowAddVendor(false)} />
      )}

      <div className="space-y-2 max-h-[350px] overflow-y-auto">
        {allGroups.map((group) => {
          const isBuiltin = builtinVendorIds.has(group.id)
          const products = group.products
            .map((idOrObj) => typeof idOrObj === 'string' ? allProducts[idOrObj] : idOrObj)
            .filter(Boolean)

          return (
            <div key={group.id} className="bg-surface-2 rounded-lg overflow-hidden border border-border">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
                  <span className="text-xs font-semibold text-text-primary">{group.name}</span>
                  {isBuiltin && <span className="text-[10px] text-text-disabled">(built-in)</span>}
                  {group.isCustom && <span className="text-[10px] text-accent-purple">(custom)</span>}
                </div>
                <div className="flex items-center gap-1">
                  <button className="btn-ghost text-[10px] py-0.5 px-1.5" onClick={() => setShowAddProduct(showAddProduct === group.id ? null : group.id)}>
                    + Product
                  </button>
                  {group.isCustom && (
                    <button className="btn-ghost text-[10px] py-0.5 px-1.5 hover:text-accent-red" onClick={() => handleDeleteVendor(group.id)}>
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {showAddProduct === group.id && (
                <div className="px-3 pb-2 border-t border-border">
                  <AddProductForm vendorId={group.id} vendorName={group.name} color={group.color}
                    onSaved={() => { setShowAddProduct(null); refresh() }} onCancel={() => setShowAddProduct(null)} />
                </div>
              )}

              <div className="divide-y divide-border-subtle">
                {products.map((p) => {
                  const isBuiltinProduct = builtinProductIds.has(p.id)
                  return (
                    <div key={p.id} className="flex items-center justify-between px-3 py-1.5 pl-8">
                      <div className="min-w-0">
                        <span className="text-xs text-text-primary">{p.fullName ?? p.name}</span>
                        <span className="text-[10px] ml-1">{DEVICE_TYPES[p.deviceType]?.icon ?? ''}</span>
                        <span className="text-[10px] text-text-muted ml-1">{p.description}</span>
                        <span className="text-[10px] text-text-disabled ml-1">({p.role})</span>
                      </div>
                      {p.isCustom && (
                        <button className="btn-ghost text-[10px] py-0.5 px-1 hover:text-accent-red flex-shrink-0" onClick={() => handleDeleteProduct(p.id)}>
                          ✕
                        </button>
                      )}
                    </div>
                  )
                })}
                {products.length === 0 && (
                  <p className="text-[10px] text-text-muted italic px-3 py-2 pl-8">No products</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function AddVendorForm({ onSaved, onCancel }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#888888')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const vendorId = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
      await window.electronAPI.customVendors.save({
        vendor_id: vendorId,
        name: name.trim(),
        color,
      })
      onSaved()
    } catch (err) {
      alert(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="bg-surface-3 rounded-lg p-3 space-y-2">
      <div className="flex gap-2">
        <input className="input text-xs flex-1" placeholder="Vendor name (e.g. Juniper)" value={name} onChange={(e) => setName(e.target.value)} />
        <input type="color" className="w-8 h-8 rounded cursor-pointer border border-border" value={color} onChange={(e) => setColor(e.target.value)} />
      </div>
      <div className="flex gap-1.5 justify-end">
        <button className="btn-ghost text-[10px]" onClick={onCancel}>Cancel</button>
        <button className="btn-primary text-[10px] py-1 px-2" disabled={saving || !name.trim()} onClick={handleSave}>
          {saving ? 'Saving��' : 'Add Vendor'}
        </button>
      </div>
    </div>
  )
}

function AddProductForm({ vendorId, vendorName, color, onSaved, onCancel }) {
  const [name, setName] = useState('')
  const [fullName, setFullName] = useState('')
  const [description, setDescription] = useState('')
  const [role, setRole] = useState('both')
  const [deviceType, setDeviceType] = useState('switch')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const productId = `${vendorId}_${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
      await window.electronAPI.customProducts.save({
        product_id: productId,
        name: name.trim(),
        full_name: fullName.trim() || `${vendorName} ${name.trim()}`,
        vendor_id: vendorId,
        vendor_name: vendorName,
        color,
        description: description.trim() || null,
        role,
        device_type: deviceType,
      })
      onSaved()
    } catch (err) {
      alert(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-2 pt-2">
      <div className="flex gap-2">
        <input className="input text-xs flex-1" placeholder="Product name (e.g. Junos)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input text-xs flex-1" placeholder="Full name (e.g. Juniper Junos)" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <input className="input text-xs flex-1" placeholder="Description (e.g. EX/QFX series)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <select className="input text-xs w-24" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="source">Source</option>
          <option value="target">Target</option>
          <option value="both">Both</option>
        </select>
        <select className="input text-xs w-28" value={deviceType} onChange={(e) => setDeviceType(e.target.value)}>
          {Object.entries(DEVICE_TYPES).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-1.5 justify-end">
        <button className="btn-ghost text-[10px]" onClick={onCancel}>Cancel</button>
        <button className="btn-primary text-[10px] py-1 px-2" disabled={saving || !name.trim()} onClick={handleSave}>
          {saving ? 'Saving…' : 'Add Product'}
        </button>
      </div>
    </div>
  )
}

function Badge({ color, label }) {
  return (
    <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{ backgroundColor: color + '25', border: `1px solid ${color}40`, color }}>
      {label}
    </div>
  )
}
