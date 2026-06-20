import type { ChangeEvent } from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { compressImage, type CompressedImage } from '../../utils/imageCompressor'

type AttachmentUploaderProps = {
  metricCode: string
  required?: boolean
}

const acceptedImageTypes = ['image/jpeg', 'image/png', 'image/webp']

export function AttachmentUploader({ metricCode, required = false }: AttachmentUploaderProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [message, setMessage] = useState('')
  const [compressing, setCompressing] = useState(false)
  const [compressedImage, setCompressedImage] = useState<CompressedImage | null>(null)

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  function clearPreview() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    setPreviewUrl('')
    setFileName('')
    setMessage('')
    setCompressedImage(null)

    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!acceptedImageTypes.includes(file.type)) {
      clearPreview()
      setMessage('File harus berupa gambar JPG, PNG, atau WebP.')
      event.target.value = ''
      return
    }

    setCompressing(true)
    setMessage('')

    try {
      const compressed = await compressImage(file)

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }

      setPreviewUrl(URL.createObjectURL(compressed.file))
      setFileName(compressed.file.name)
      setCompressedImage(compressed)
    } catch (error) {
      clearPreview()
      setMessage(error instanceof Error ? error.message : 'Kompresi gambar gagal.')
      event.target.value = ''
    } finally {
      setCompressing(false)
    }
  }

  return (
    <div className="attachment-uploader" data-metric-code={metricCode}>
      <div className="attachment-actions">
        <label className="attachment-button" htmlFor={inputId}>
          {previewUrl ? 'Ganti gambar' : 'Ambil / upload gambar'}
        </label>
        {previewUrl ? (
          <button onClick={clearPreview} type="button">
            Hapus
          </button>
        ) : null}
      </div>

      <input
        accept={acceptedImageTypes.join(',')}
        capture="environment"
        className="visually-hidden-file"
        disabled={compressing}
        id={inputId}
        onChange={handleFileChange}
        ref={inputRef}
        required={required}
        type="file"
      />

      {compressing ? <p className="metric-card-hint">Mengompresi gambar...</p> : null}

      {previewUrl ? (
        <figure className="attachment-preview">
          <img alt={`Preview ${metricCode}`} src={previewUrl} />
          <figcaption>
            {fileName}
            {compressedImage
              ? ` | ${compressedImage.width}x${compressedImage.height}px | ${Math.ceil(
                  compressedImage.compressedSize / 1024
                )} KB`
              : ''}
          </figcaption>
        </figure>
      ) : null}

      {message ? (
        <p className="form-message error" role="status">
          {message}
        </p>
      ) : null}
    </div>
  )
}
