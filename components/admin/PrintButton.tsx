'use client'

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="h-11 rounded-lg bg-green-700 px-4 font-semibold text-white print:hidden">
      In phiếu
    </button>
  )
}
