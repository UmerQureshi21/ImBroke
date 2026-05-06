import { useRef } from 'react'

interface Props {
  onUpload: (file: File) => void
  uploading: boolean
  message: string
}

export default function UploadZone({ onUpload, uploading, message }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <section>
      <div
        className="border-2 border-dashed border-green-300 rounded-xl bg-white p-10 text-center cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files[0]
          if (file) onUpload(file)
        }}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-7 h-7 border-[3px] border-green-200 border-t-green-600 rounded-full animate-spin" />
            <p className="text-green-600 font-medium text-sm">Categorizing with AI...</p>
          </div>
        ) : (
          <>
            <p className="text-gray-700 text-sm">
              Drop your CSV here or{' '}
              <span className="text-green-600 font-semibold underline">click to upload</span>
            </p>
            <p className="text-gray-400 text-xs mt-1.5">TD bank statement CSV</p>
          </>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            onUpload(file)
            e.target.value = ''
          }
        }}
      />
      {message && (
        <p className={`mt-3 text-sm font-medium ${message.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}
    </section>
  )
}
