'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import ImagePlus from 'lucide-react/dist/esm/icons/image-plus'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import Users from 'lucide-react/dist/esm/icons/users'
import Calendar from 'lucide-react/dist/esm/icons/calendar'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import { uploadProjectCoverImage, ImageUploadError } from '@/lib/supabase/upload-image'
import { updateProjectCoverImage } from '@/app/(dashboard)/projects/[key]/actions'
import { getSignedUrl } from '@/lib/supabase/upload-image'
import { TRANSITION } from '@/lib/motion'
import { toast } from 'sonner'

// 프로젝트 key 해시 기반 그라디언트 생성
function keyToGradient(key: string): string {
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue1 = Math.abs(hash % 360)
  const hue2 = (hue1 + 40) % 360
  return `linear-gradient(135deg, hsl(${hue1}, 60%, 50%), hsl(${hue2}, 70%, 40%))`
}

const PROJECT_TYPE_LABELS: Record<string, string> = {
  requirement: '요구사항',
  issue: '이슈',
}

interface ProjectIntroSectionProps {
  projectId: string
  projectKey: string
  projectName: string
  projectType: string
  description: string | null
  coverImagePath: string | null
  owner: { id: string; full_name: string | null; avatar_url: string | null } | null
  memberCount: number
  createdAt: string
  canEdit: boolean
}

export function ProjectIntroSection({
  projectId,
  projectKey,
  projectName,
  projectType,
  description,
  coverImagePath,
  owner,
  memberCount,
  createdAt,
  canEdit,
}: ProjectIntroSectionProps) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [coverPath, setCoverPath] = useState(coverImagePath)
  const [uploading, setUploading] = useState(false)
  const [hoverCover, setHoverCover] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [clamped, setClamped] = useState(false)
  const descRef = useRef<HTMLParagraphElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 커버 이미지 signed URL 로드
  const loadCoverUrl = useCallback(async (path: string) => {
    const url = await getSignedUrl(path)
    if (url) setCoverUrl(url)
  }, [])

  // 초기 로드
  useState(() => {
    if (coverPath) {
      void loadCoverUrl(coverPath)
    }
  })

  // 설명 텍스트 clamp 감지
  const descCallbackRef = useCallback((node: HTMLParagraphElement | null) => {
    if (node) {
      (descRef as React.MutableRefObject<HTMLParagraphElement>).current = node
      setClamped(node.scrollHeight > node.clientHeight)
    }
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const storagePath = await uploadProjectCoverImage(file, projectId)
      const result = await updateProjectCoverImage(projectId, storagePath)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setCoverPath(storagePath)
      void loadCoverUrl(storagePath)
    } catch (err) {
      if (err instanceof ImageUploadError) {
        toast.error(err.message)
      } else {
        toast.error('커버 이미지 업로드에 실패했습니다.')
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveCover = async () => {
    setUploading(true)
    try {
      const result = await updateProjectCoverImage(projectId, null)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setCoverPath(null)
      setCoverUrl(null)
    } catch {
      toast.error('커버 이미지 삭제에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const formattedDate = new Date(createdAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const ownerInitial = owner?.full_name?.charAt(0) || '?'

  return (
    <div className="space-y-4">
      {/* 커버 이미지 */}
      <div
        className="relative h-48 w-full rounded-xl overflow-hidden"
        onMouseEnter={() => setHoverCover(true)}
        onMouseLeave={() => setHoverCover(false)}
      >
        {coverUrl && coverPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={`${projectName} 커버 이미지`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{ background: keyToGradient(projectKey) }}
          />
        )}

        {/* 호버 오버레이 */}
        <AnimatePresence>
          {canEdit && hoverCover && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={TRANSITION.fast}
              className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2"
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <ImagePlus className="h-4 w-4 mr-1.5" />
                {coverPath ? '커버 변경' : '커버 추가'}
              </Button>
              {coverPath && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRemoveCover}
                  disabled={uploading}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  삭제
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* 프로젝트 정보 */}
      <div className="space-y-3">
        {/* 제목 행 */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="font-mono text-xs">
            {projectKey}
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight">{projectName}</h1>
          <Badge variant="secondary" className="text-xs">
            {PROJECT_TYPE_LABELS[projectType] || projectType}
          </Badge>
        </div>

        {/* 설명 */}
        {description && (
          <div>
            <p
              ref={descCallbackRef}
              className={
                expanded
                  ? 'text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap'
                  : 'text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap line-clamp-3'
              }
            >
              {description}
            </p>
            {clamped && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-xs text-primary hover:underline mt-1"
              >
                <span className="flex items-center gap-0.5">
                  {expanded ? '접기' : '더 보기'}
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
                  />
                </span>
              </button>
            )}
          </div>
        )}

        {/* 메타 정보 */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
          {owner && (
            <div className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5">
                <AvatarImage src={owner.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">{ownerInitial}</AvatarFallback>
              </Avatar>
              <span>{owner.full_name || '알 수 없음'}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            <span>팀원 {memberCount}명</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>{formattedDate} 생성</span>
          </div>
        </div>
      </div>
    </div>
  )
}
