export type CompressedImage = {
  file: File
  width: number
  height: number
  originalSize: number
  compressedSize: number
}

type CompressionOptions = {
  maxDimension?: number
  quality?: number
}

const defaultCompressionOptions = {
  maxDimension: 1280,
  quality: 0.5
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Gambar tidak bisa dibaca.'))
    }
    image.src = objectUrl
  })
}

function resizedDimensions(width: number, height: number, maxDimension: number) {
  const longestSide = Math.max(width, height)

  if (longestSide <= maxDimension) {
    return { width, height }
  }

  const scale = maxDimension / longestSide

  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale)
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
          return
        }

        reject(new Error('Kompresi gambar gagal.'))
      },
      'image/webp',
      quality
    )
  })
}

export async function compressImage(file: File, options: CompressionOptions = {}) {
  const { maxDimension, quality } = {
    ...defaultCompressionOptions,
    ...options
  }
  const image = await loadImage(file)
  const dimensions = resizedDimensions(image.naturalWidth, image.naturalHeight, maxDimension)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas browser tidak tersedia.')
  }

  canvas.width = dimensions.width
  canvas.height = dimensions.height
  context.drawImage(image, 0, 0, dimensions.width, dimensions.height)

  const blob = await canvasToBlob(canvas, quality)
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'attachment'
  const compressedFile = new File([blob], `${baseName}.webp`, {
    type: 'image/webp',
    lastModified: Date.now()
  })

  return {
    file: compressedFile,
    width: dimensions.width,
    height: dimensions.height,
    originalSize: file.size,
    compressedSize: compressedFile.size
  } satisfies CompressedImage
}
