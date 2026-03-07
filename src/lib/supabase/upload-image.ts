import { createClient } from './client'
import type { CommentAttachment } from '@/types/database'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
const SIGNED_URL_EXPIRY = 60 * 60 // 1시간

export class ImageUploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageUploadError'
  }
}

/**
 * 이미지를 Supabase Storage에 업로드하고 메타데이터를 반환
 */
export async function uploadImage(
  file: File,
  projectId: string,
  workItemId: string
): Promise<CommentAttachment> {
  if (file.size > MAX_FILE_SIZE) {
    throw new ImageUploadError('파일 크기가 5MB를 초과합니다.')
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new ImageUploadError('PNG, JPEG, GIF, WebP 이미지만 업로드 가능합니다.')
  }

  const id = crypto.randomUUID()
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const storagePath = `${projectId}/${workItemId}/${id}.${ext}`

  const supabase = createClient()
  const { error } = await supabase.storage
    .from('attachments')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (error) {
    throw new ImageUploadError(`업로드 실패: ${error.message}`)
  }

  return {
    id,
    storage_path: storagePath,
    file_name: file.name,
    file_size: file.size,
    content_type: file.type,
  }
}

/**
 * Storage 경로에서 signed URL을 생성
 */
export async function getSignedUrl(storagePath: string): Promise<string | null> {
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from('attachments')
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY)

  if (error || !data) return null
  return data.signedUrl
}

/**
 * 여러 Storage 경로의 signed URL을 일괄 생성
 */
export async function getSignedUrls(
  paths: string[]
): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map()

  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from('attachments')
    .createSignedUrls(paths, SIGNED_URL_EXPIRY)

  const urlMap = new Map<string, string>()
  if (error || !data) return urlMap

  for (const item of data) {
    if (item.signedUrl && item.path) {
      urlMap.set(item.path, item.signedUrl)
    }
  }
  return urlMap
}

/**
 * 프로젝트 커버 이미지를 Supabase Storage에 업로드
 */
export async function uploadProjectCoverImage(
  file: File,
  projectId: string
): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new ImageUploadError('파일 크기가 5MB를 초과합니다.')
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new ImageUploadError('PNG, JPEG, GIF, WebP 이미지만 업로드 가능합니다.')
  }

  const id = crypto.randomUUID()
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const storagePath = `${projectId}/cover/${id}.${ext}`

  const supabase = createClient()
  const { error } = await supabase.storage
    .from('attachments')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (error) {
    throw new ImageUploadError(`업로드 실패: ${error.message}`)
  }

  return storagePath
}

/**
 * Storage에서 파일 삭제
 */
export async function deleteStorageFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return

  const supabase = createClient()
  await supabase.storage.from('attachments').remove(paths)
}
