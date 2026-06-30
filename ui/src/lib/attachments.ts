export const MAX_ATTACHMENTS = 5
export const MAX_FILE_BYTES = 10 * 1024 * 1024

export const DATA_FILE_EXTENSIONS = ['.xlsx', '.xls', '.csv'] as const
export const CONTEXT_FILE_EXTENSIONS = [
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.txt',
  '.json',
  '.docx'
] as const

export const ACCEPTED_FILE_TYPES = [
  ...DATA_FILE_EXTENSIONS,
  ...CONTEXT_FILE_EXTENSIONS
].join(',')

export type AttachmentKind = 'data' | 'context'

export interface MessageAttachment {
  name: string
  type: string
  size: number
  kind: AttachmentKind
}

export function getFileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot >= 0 ? filename.slice(dot).toLowerCase() : ''
}

export function isDataFile(file: File): boolean {
  return DATA_FILE_EXTENSIONS.includes(
    getFileExtension(file.name) as (typeof DATA_FILE_EXTENSIONS)[number]
  )
}

export function isContextFile(file: File): boolean {
  return CONTEXT_FILE_EXTENSIONS.includes(
    getFileExtension(file.name) as (typeof CONTEXT_FILE_EXTENSIONS)[number]
  )
}

export function isAcceptedFile(file: File): boolean {
  return isDataFile(file) || isContextFile(file)
}

export function toMessageAttachment(file: File): MessageAttachment {
  return {
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    kind: isDataFile(file) ? 'data' : 'context'
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function validateAttachments(files: File[]): string | null {
  if (files.length > MAX_ATTACHMENTS) {
    return `You can attach at most ${MAX_ATTACHMENTS} files.`
  }

  const dataFiles = files.filter(isDataFile)
  if (dataFiles.length > 1) {
    return 'Only one spreadsheet (.xlsx, .xls, .csv) can be attached per message.'
  }

  for (const file of files) {
    if (!isAcceptedFile(file)) {
      return `Unsupported file type: ${file.name}`
    }
    if (file.size > MAX_FILE_BYTES) {
      return `${file.name} exceeds the 10 MB size limit.`
    }
  }

  return null
}

export interface DatasetUploadResult {
  filename: string
  row_count: number
  columns: string[]
  schema: Record<string, unknown>
}

export function augmentMessageWithSchema(
  message: string,
  upload: DatasetUploadResult
): string {
  const columnList = upload.columns.join(', ')
  const schemaNote = [
    `[Dataset uploaded: ${upload.filename}]`,
    `Rows: ${upload.row_count}. Columns: ${columnList}.`,
    'The active book has been reloaded with this data.',
    'Use describe_schema to confirm column names before querying.'
  ].join(' ')

  const trimmed = message.trim()
  return trimmed ? `${trimmed}\n\n${schemaNote}` : schemaNote
}
