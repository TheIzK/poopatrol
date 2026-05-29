import { Suspense } from 'react'
import Link from 'next/link'
import ReviewForm from '@/components/ReviewForm'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ name?: string }>
}

export default async function ReviewPage({ params, searchParams }: Props) {
  const { id } = await params
  const { name } = await searchParams
  const bathroomName = name ? decodeURIComponent(name) : 'This Bathroom'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-amber-500 text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <Link href="/" className="text-white/80 hover:text-white text-sm">
          ← Back
        </Link>
        <span className="font-bold text-lg tracking-tight">Write a Review</span>
      </header>
      <Suspense fallback={<div className="p-4 text-gray-400 text-sm">Loading…</div>}>
        <ReviewForm bathroomId={id} bathroomName={bathroomName} />
      </Suspense>
    </div>
  )
}
