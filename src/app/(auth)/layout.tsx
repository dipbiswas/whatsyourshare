export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-indigo-50">
      <div className="w-full max-w-md px-4 py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">W</span>
            </div>
            <span className="text-xl font-bold text-gray-900">WhatsYourShare</span>
          </div>
          <p className="text-sm text-gray-500">Enterprise expense splitting</p>
        </div>
        {children}
      </div>
    </div>
  )
}
