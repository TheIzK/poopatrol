import Link from 'next/link'
import AddLocationForm from '@/components/AddLocationForm'

export default function AddLocationPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-amber-500 text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <Link href="/" className="text-white/80 hover:text-white text-sm">
          ← Back
        </Link>
        <span className="font-bold text-lg tracking-tight">Add a Restroom</span>
      </header>
      <AddLocationForm />
    </div>
  )
}
