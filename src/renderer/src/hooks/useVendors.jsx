import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  PRODUCTS, VENDOR_GROUPS, SOURCE_GROUPS, TARGET_GROUPS,
  mergeCustomData, BUILTIN_VENDOR_IDS, BUILTIN_PRODUCT_IDS,
} from '../constants/vendors'

const VendorContext = createContext(null)

export function VendorProvider({ children }) {
  const [allProducts, setAllProducts] = useState(PRODUCTS)
  const [allGroups, setAllGroups] = useState(VENDOR_GROUPS)
  const [sourceGroups, setSourceGroups] = useState(SOURCE_GROUPS)
  const [targetGroups, setTargetGroups] = useState(TARGET_GROUPS)
  const [customVendors, setCustomVendors] = useState([])
  const [customProducts, setCustomProducts] = useState([])

  const refresh = useCallback(async () => {
    try {
      const [cv, cp] = await Promise.all([
        window.electronAPI?.customVendors?.list() ?? [],
        window.electronAPI?.customProducts?.list() ?? [],
      ])
      setCustomVendors(cv)
      setCustomProducts(cp)
      const merged = mergeCustomData(cv, cp)
      setAllProducts(merged.allProducts)
      setAllGroups(merged.allGroups)
      setSourceGroups(merged.sourceGroups)
      setTargetGroups(merged.targetGroups)
    } catch (err) {
      console.error('[vendors] Failed to load custom vendors:', err)
    }
  }, [])

  // Initial load + 60s polling
  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 60_000)
    return () => clearInterval(interval)
  }, [refresh])

  const value = {
    allProducts,
    allGroups,
    sourceGroups,
    targetGroups,
    customVendors,
    customProducts,
    builtinVendorIds: BUILTIN_VENDOR_IDS,
    builtinProductIds: BUILTIN_PRODUCT_IDS,
    refresh,
  }

  return <VendorContext.Provider value={value}>{children}</VendorContext.Provider>
}

export function useVendors() {
  const ctx = useContext(VendorContext)
  if (!ctx) {
    // Fallback for when not wrapped in VendorProvider
    return {
      allProducts: PRODUCTS,
      allGroups: VENDOR_GROUPS,
      sourceGroups: SOURCE_GROUPS,
      targetGroups: TARGET_GROUPS,
      customVendors: [],
      customProducts: [],
      builtinVendorIds: BUILTIN_VENDOR_IDS,
      builtinProductIds: BUILTIN_PRODUCT_IDS,
      refresh: () => {},
    }
  }
  return ctx
}
