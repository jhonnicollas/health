export type WatermarkOptions = {
  displayName: string
  userId: string
  timestamp?: Date
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
}

type WatermarkedImage = {
  file: File
  width: number
  height: number
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

function formatTimestamp(date: Date): string {
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function getPositionCoordinates(
  width: number,
  height: number,
  textWidth: number,
  textHeight: number,
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left',
  padding: number = 10
): { x: number; y: number } {
  switch (position) {
    case 'bottom-right':
      return {
        x: width - textWidth - padding,
        y: height - textHeight - padding
      }
    case 'bottom-left':
      return {
        x: padding,
        y: height - textHeight - padding
      }
    case 'top-right':
      return {
        x: width - textWidth - padding,
        y: textHeight + padding
      }
    case 'top-left':
      return {
        x: padding,
        y: textHeight + padding
      }
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
          return
        }
        reject(new Error('Watermark gambar gagal.'))
      },
      'image/webp',
      0.9
    )
  })
}

export async function addWatermark(
  file: File,
  options: WatermarkOptions
): Promise<WatermarkedImage> {
  const {
    displayName,
    userId,
    timestamp = new Date(),
    position = 'bottom-right'
  } = options

  const image = await loadImage(file)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas browser tidak tersedia.')
  }

  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight

  // Draw original image
  context.drawImage(image, 0, 0)

  // Calculate font size based on image dimensions
  const fontSize = Math.max(12, Math.floor(image.naturalWidth / 40))
  context.font = `${fontSize}px Arial, sans-serif`
  context.textBaseline = 'bottom'

  // Build watermark text
  const timestampText = formatTimestamp(timestamp)
  const userText = `${displayName} (${userId.slice(0, 8)}...)`
  const watermarkText = `${userText}\n${timestampText}`

  // Measure text for positioning
  const lines = watermarkText.split('\n')
  const lineHeight = fontSize * 1.2
  const textWidth = Math.max(...lines.map(line => context.measureText(line).width))
  const textHeight = lines.length * lineHeight

  // Add semi-transparent background for readability
  const { x, y } = getPositionCoordinates(
    canvas.width,
    canvas.height,
    textWidth,
    textHeight,
    position
  )

  // Draw background rectangle
  context.fillStyle = 'rgba(0, 0, 0, 0.5)'
  const bgPadding = 8
  const bgX = position.includes('right') ? x - bgPadding : x - bgPadding
  const bgY = position.includes('bottom') ? y - textHeight - bgPadding : y - textHeight + bgPadding
  const bgWidth = textWidth + bgPadding * 2
  const bgHeight = textHeight + bgPadding * 2

  context.fillRect(bgX, bgY, bgWidth, bgHeight)

  // Draw watermark text
  context.fillStyle = '#ffffff'
  context.textBaseline = 'bottom'

  lines.forEach((line, index) => {
    const lineX = position.includes('right') ? x : x
    const lineY = position.includes('bottom') ? y - (lines.length - 1 - index) * lineHeight : y + bgPadding - (lines.length - 1 - index) * lineHeight + textHeight
    context.fillText(line, lineX, lineY)
  })

  // Convert to blob and create File
  const blob = await canvasToBlob(canvas)
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'watermarked'
  const watermarkedFile = new File([blob], `${baseName}-watermarked.webp`, {
    type: 'image/webp',
    lastModified: Date.now()
  })

  return {
    file: watermarkedFile,
    width: canvas.width,
    height: canvas.height
  }
}
