'use client'

import { Check } from 'lucide-react'
import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { CatalogProduct } from '@/lib/catalog/queries'

type TabsProduct = Pick<CatalogProduct, 'benefits' | 'composition' | 'usage' | 'crops' | 'description'>

const lines = (s: string | null) => (s ?? '').split('\n').map((l) => l.trim()).filter(Boolean)

function Lines({ items, marker }: { items: string[]; marker: 'check' | 'dot' }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((l, i) => (
        <li key={i} className="flex gap-3">
          {marker === 'check' ? (
            <Check aria-hidden className="mt-1 size-5 shrink-0 text-primary" />
          ) : (
            <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent" />
          )}
          <span>{l}</span>
        </li>
      ))}
    </ul>
  )
}

/** Các tab thông tin sản phẩm; chỉ hiện tab có nội dung, không còn tab nào thì không render. */
export function ProductTabs({ product }: { product: TabsProduct }) {
  const baseId = useId()
  const benefits = lines(product.benefits)
  const usage = lines(product.usage)
  const crops = product.crops.map((c) => c.trim()).filter(Boolean)
  const composition = product.composition?.trim() ?? ''
  const description = product.description?.trim() ?? ''

  const tabs: { key: string; label: string; body: ReactNode }[] = []
  if (benefits.length) tabs.push({ key: 'benefits', label: 'Công dụng', body: <Lines items={benefits} marker="check" /> })
  if (composition) tabs.push({ key: 'composition', label: 'Thành phần', body: <p className="whitespace-pre-line">{composition}</p> })
  if (usage.length) tabs.push({ key: 'usage', label: 'Cách dùng', body: <Lines items={usage} marker="dot" /> })
  if (crops.length) {
    tabs.push({
      key: 'crops',
      label: 'Cây phù hợp',
      body: (
        <div className="flex flex-wrap gap-2">
          {crops.map((c) => (
            <span key={c} className="rounded-full border border-primary/20 bg-primary-soft px-3.5 py-1.5 font-semibold text-primary-hover">
              {c}
            </span>
          ))}
        </div>
      ),
    })
  }
  if (description) tabs.push({ key: 'description', label: 'Mô tả', body: <p className="whitespace-pre-line">{description}</p> })

  const [selected, setSelected] = useState(0)
  if (tabs.length === 0) return null
  const current = Math.min(selected, tabs.length - 1)
  const tabId = (i: number) => `${baseId}-tab-${tabs[i].key}`

  // Mũi tên trái/phải chuyển tab (mẫu tablist của WAI-ARIA).
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const next = (current + delta + tabs.length) % tabs.length
    setSelected(next)
    document.getElementById(tabId(next))?.focus()
  }

  return (
    <section className="flex flex-col gap-4">
      <div role="tablist" aria-label="Thông tin sản phẩm" onKeyDown={onKeyDown} className="-mx-4 flex gap-1 overflow-x-auto border-b border-stone-200 px-4 md:mx-0 md:px-0">
        {tabs.map((t, i) => (
          <button
            key={t.key}
            id={tabId(i)}
            type="button"
            role="tab"
            aria-selected={i === current}
            aria-controls={`${baseId}-panel`}
            tabIndex={i === current ? 0 : -1}
            onClick={() => setSelected(i)}
            className={`-mb-px h-12 shrink-0 border-b-[3px] px-3 font-semibold transition-colors ${
              i === current ? 'border-accent text-ink' : 'border-transparent text-stone-500 hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={tabId(current)} className="max-w-prose text-[17px] leading-relaxed text-stone-800">
        {tabs[current].body}
      </div>
    </section>
  )
}
