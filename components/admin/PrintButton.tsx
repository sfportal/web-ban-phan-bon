'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui'

export function PrintButton() {
  return (
    <Button onClick={() => window.print()} className="print:hidden">
      <Printer aria-hidden className="size-5" />In phiếu
    </Button>
  )
}
