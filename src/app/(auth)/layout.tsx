export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-12">
      {/* Brand */}
      <div className="text-center mb-8">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 shadow-lg shadow-violet-900/50 mb-4">
          <span className="text-white font-bold text-xl">W</span>
        </div>
        <h1 className="text-2xl font-bold text-white">WhatsYourShare</h1>
        <p className="text-sm text-white/50 mt-1">Split expenses. Stay friends.</p>
      </div>
      <div className="w-full max-w-sm">
        {children}
      </div>
    </div>
  )
}
