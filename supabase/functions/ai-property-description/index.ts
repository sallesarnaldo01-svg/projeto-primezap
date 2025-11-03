// Minimal stub for ai-property-description Edge Function (Deno)
// Reads property fields and returns a concise description string.
// Integrate your LLM provider as needed.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

type Input = {
  title?: string
  address?: string
  bedrooms?: number
  bathrooms?: number
  area?: number
  extras?: string[]
}

serve(async (req) => {
  try {
    const input = (await req.json()) as Input
    const parts: string[] = []
    if (input.title) parts.push(input.title)
    if (input.address) parts.push(`em ${input.address}`)

    const specs: string[] = []
    if (typeof input.bedrooms === 'number') specs.push(`${input.bedrooms} dormitório(s)`)
    if (typeof input.bathrooms === 'number') specs.push(`${input.bathrooms} banheiro(s)`)
    if (typeof input.area === 'number') specs.push(`${input.area} m²`)
    if (specs.length) parts.push(`(${specs.join(', ')})`)
    if (input.extras?.length) parts.push(`Diferenciais: ${input.extras.join(', ')}`)

    const description = parts.join(' ')
    return new Response(JSON.stringify({ description }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
})

