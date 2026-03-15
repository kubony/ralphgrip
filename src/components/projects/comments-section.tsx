'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { useConfirmDialog } from '@/hooks/use-confirm-dialog'
import { Button } from '@/components/ui/button'
import { ActorAvatar, getActorName } from '@/components/ui/actor-avatar'
import { MentionTextarea } from './mention-textarea'
import { CommentText } from './comment-text'
import type { PersonRef, CommentAttachment } from '@/types/database'
import {
  getComments,
  createComment,
  updateComment,
  deleteComment,
} from '@/app/(dashboard)/projects/[key]/actions'
import { uploadImage, getSignedUrls } from '@/lib/supabase/upload-image'
import { cn } from '@/lib/utils'
import Send from 'lucide-react/dist/esm/icons/send'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import Pencil from 'lucide-react/dist/esm/icons/pencil'
import X from 'lucide-react/dist/esm/icons/x'
import Check from 'lucide-react/dist/esm/icons/check'
import Paperclip from 'lucide-react/dist/esm/icons/paperclip'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'

interface Author {
  id: string
  full_name: string | null
  avatar_url: string | null
}

interface CommentAgent {
  id: string
  display_name: string
  avatar_url: string | null
  agent_type: string
}

interface Comment {
  id: string
  content: string
  created_at: string
  updated_at: string
  author: Author | null
  agent: CommentAgent | null
  attachments: CommentAttachment[]
}

interface UploadingFile {
  id: string
  objectUrl: string
  name: string
}

interface CommentsSectionProps {
  workItemId: string
  projectId: string
  currentUserId?: string
  members: PersonRef[]
}

// 모듈 스코프 유틸리티 (리렌더마다 재생성 방지)
function getInitials(name: string | null | undefined) {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatCommentDate(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '방금 전'
  if (diffMins < 60) return `${diffMins}분 전`
  if (diffHours < 24) return `${diffHours}시간 전`
  if (diffDays < 7) return `${diffDays}일 전`
  return date.toLocaleDateString('ko-KR')
}

export function CommentsSection({
  workItemId,
  projectId,
  currentUserId,
  members,
}: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  // 새 댓글 첨부
  const [pendingAttachments, setPendingAttachments] = useState<CommentAttachment[]>([])
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])

  // 수정 모드 첨부
  const [editAttachments, setEditAttachments] = useState<CommentAttachment[]>([])
  const [editUploadingFiles, setEditUploadingFiles] = useState<UploadingFile[]>([])

  // signed URL 맵
  const [signedUrlMap, setSignedUrlMap] = useState<Map<string, string>>(new Map())

  const fileInputRef = useRef<HTMLInputElement>(null)
  const editFileInputRef = useRef<HTMLInputElement>(null)
  const confirm = useConfirmDialog()

  // signed URL 갱신
  const refreshSignedUrls = useCallback(async (commentList: Comment[]) => {
    const paths = commentList.flatMap((c) =>
      (c.attachments || []).map((a) => a.storage_path)
    )
    if (paths.length === 0) return
    const map = await getSignedUrls(paths)
    setSignedUrlMap((prev) => {
      const next = new Map(prev)
      map.forEach((url, path) => next.set(path, url))
      return next
    })
  }, [])

  // 댓글 로드
  useEffect(() => {
    async function loadComments() {
      setIsLoading(true)
      const result = await getComments(workItemId)
      if (result.data) {
        const loaded = result.data as Comment[]
        setComments(loaded)
        await refreshSignedUrls(loaded)
      }
      setIsLoading(false)
    }
    loadComments()
  }, [workItemId, refreshSignedUrls])

  // 파일 업로드 핸들러 (새 댓글용)
  const handleFileUpload = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files)
      const remaining = 5 - pendingAttachments.length - uploadingFiles.length
      if (remaining <= 0) {
        toast.error('최대 5개까지 첨부 가능합니다.')
        return
      }
      const toUpload = fileArray.slice(0, remaining)

      const previews: UploadingFile[] = toUpload.map((f) => ({
        id: crypto.randomUUID(),
        objectUrl: URL.createObjectURL(f),
        name: f.name,
      }))
      setUploadingFiles((prev) => [...prev, ...previews])

      const results = await Promise.allSettled(
        toUpload.map((f) => uploadImage(f, projectId, workItemId))
      )

      const succeeded: CommentAttachment[] = []
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          succeeded.push(r.value)
        } else {
          toast.error(`${toUpload[i].name} 업로드 실패`)
        }
      })

      previews.forEach((p) => URL.revokeObjectURL(p.objectUrl))
      setUploadingFiles((prev) => prev.filter((u) => !previews.some((p) => p.id === u.id)))
      setPendingAttachments((prev) => [...prev, ...succeeded])

      // 새로 추가된 이미지의 signed URL 갱신
      if (succeeded.length > 0) {
        const paths = succeeded.map((a) => a.storage_path)
        const map = await getSignedUrls(paths)
        setSignedUrlMap((prev) => {
          const next = new Map(prev)
          map.forEach((url, path) => next.set(path, url))
          return next
        })
      }
    },
    [pendingAttachments.length, uploadingFiles.length, projectId, workItemId]
  )

  // 파일 업로드 핸들러 (수정 모드용)
  const handleEditFileUpload = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files)
      const remaining = 5 - editAttachments.length - editUploadingFiles.length
      if (remaining <= 0) {
        toast.error('최대 5개까지 첨부 가능합니다.')
        return
      }
      const toUpload = fileArray.slice(0, remaining)

      const previews: UploadingFile[] = toUpload.map((f) => ({
        id: crypto.randomUUID(),
        objectUrl: URL.createObjectURL(f),
        name: f.name,
      }))
      setEditUploadingFiles((prev) => [...prev, ...previews])

      const results = await Promise.allSettled(
        toUpload.map((f) => uploadImage(f, projectId, workItemId))
      )

      const succeeded: CommentAttachment[] = []
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          succeeded.push(r.value)
        } else {
          toast.error(`${toUpload[i].name} 업로드 실패`)
        }
      })

      previews.forEach((p) => URL.revokeObjectURL(p.objectUrl))
      setEditUploadingFiles((prev) => prev.filter((u) => !previews.some((p) => p.id === u.id)))
      setEditAttachments((prev) => [...prev, ...succeeded])

      if (succeeded.length > 0) {
        const paths = succeeded.map((a) => a.storage_path)
        const map = await getSignedUrls(paths)
        setSignedUrlMap((prev) => {
          const next = new Map(prev)
          map.forEach((url, path) => next.set(path, url))
          return next
        })
      }
    },
    [editAttachments.length, editUploadingFiles.length, projectId, workItemId]
  )

  // 붙여넣기 핸들러
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items)
      const imageItems = items
        .filter((item) => item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null)
      if (imageItems.length > 0) {
        e.preventDefault()
        void handleFileUpload(imageItems)
      }
    },
    [handleFileUpload]
  )

  // 드래그 앤 드롭 핸들러
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDraggingOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDraggingOver(false)
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/')
      )
      if (files.length > 0) {
        void handleFileUpload(files)
      }
    },
    [handleFileUpload]
  )

  // 댓글 작성
  const handleSubmit = async () => {
    if (!newComment.trim() && pendingAttachments.length === 0) return
    if (isSubmitting) return

    setIsSubmitting(true)
    const result = await createComment(workItemId, newComment, projectId, pendingAttachments)
    if (result.data) {
      const newC = result.data as Comment
      if (!newC.attachments) newC.attachments = []
      setComments((prev) => [...prev, newC])
      setNewComment('')
      setPendingAttachments([])
    } else if (result.error) {
      toast.error('댓글 작성에 실패했습니다.')
    }
    setIsSubmitting(false)
  }

  // 댓글 수정
  const handleUpdate = async (commentId: string) => {
    if (!editContent.trim() && editAttachments.length === 0) return
    if (isSubmitting) return

    setIsSubmitting(true)
    const result = await updateComment(commentId, editContent, projectId, editAttachments)
    if (result.success) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, content: editContent.trim(), attachments: editAttachments }
            : c
        )
      )
      setEditingId(null)
      setEditContent('')
      setEditAttachments([])
    } else if (result.error) {
      toast.error('댓글 수정에 실패했습니다.')
    }
    setIsSubmitting(false)
  }

  // 댓글 삭제
  const handleDelete = async (commentId: string) => {
    const confirmed = await confirm({
      title: '댓글 삭제',
      description: '이 댓글을 삭제하시겠습니까?',
      actionLabel: '삭제',
      cancelLabel: '취소',
      variant: 'destructive',
    })
    if (!confirmed) return

    const result = await deleteComment(commentId, projectId)
    if (result.success) {
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    } else if (result.error) {
      toast.error('댓글 삭제에 실패했습니다.')
    }
  }

  const startEdit = (comment: Comment) => {
    setEditingId(comment.id)
    setEditContent(comment.content)
    setEditAttachments(comment.attachments || [])
    setEditUploadingFiles([])
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditContent('')
    setEditAttachments([])
    setEditUploadingFiles([])
  }

  // getInitials, formatCommentDate는 모듈 스코프에 호이스팅됨

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">댓글</h4>
        {[1, 2].map((i) => (
          <div key={i} className="flex gap-2">
            <div className="h-7 w-7 rounded-full bg-muted animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-24 bg-muted rounded animate-pulse" />
              <div className="h-3 w-full bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">
        댓글 ({comments.length})
      </h4>

      {/* 댓글 목록 */}
      <div className="space-y-3 max-h-[300px] overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            아직 댓글이 없습니다.
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-2 group">
              <ActorAvatar
                profile={comment.author}
                agent={comment.agent}
                size="sm"
                className="h-7 w-7"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {getActorName(comment.author, comment.agent)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatCommentDate(comment.created_at)}
                  </span>
                </div>
                {editingId === comment.id ? (
                  <div className="mt-1 space-y-2">
                    <MentionTextarea
                      value={editContent}
                      onChange={setEditContent}
                      members={members}
                      className="h-[60px] text-sm"
                      autoFocus
                      onSubmit={() => handleUpdate(comment.id)}
                    />
                    {/* 수정 모드 첨부 미리보기 */}
                    {(editAttachments.length > 0 || editUploadingFiles.length > 0) && (
                      <div className="flex gap-2 flex-wrap">
                        {editAttachments.map((att) => {
                          const url = signedUrlMap.get(att.storage_path)
                          return (
                            <div key={att.id} className="relative group/img">
                              {url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={url}
                                  alt={att.file_name}
                                  className="w-16 h-16 object-cover rounded border border-border"
                                />
                              ) : (
                                <div className="w-16 h-16 rounded border border-border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                                  {att.file_name.slice(0, 6)}
                                </div>
                              )}
                              <button
                                type="button"
                                className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                                onClick={() =>
                                  setEditAttachments((prev) =>
                                    prev.filter((a) => a.id !== att.id)
                                  )
                                }
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          )
                        })}
                        {editUploadingFiles.map((u) => (
                          <div
                            key={u.id}
                            className="relative w-16 h-16 rounded border border-border overflow-hidden"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={u.objectUrl}
                              alt={u.name}
                              className="w-full h-full object-cover opacity-40"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-1 items-center">
                      <input
                        ref={editFileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) void handleEditFileUpload(e.target.files)
                          e.target.value = ''
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        type="button"
                        onClick={() => editFileInputRef.current?.click()}
                      >
                        <Paperclip className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => handleUpdate(comment.id)}
                        disabled={isSubmitting}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        저장
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={cancelEdit}
                      >
                        <X className="h-3 w-3 mr-1" />
                        취소
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <CommentText text={comment.content} />
                    {/* 댓글 이미지 그리드 */}
                    {comment.attachments && comment.attachments.length > 0 && (
                      <div className="flex gap-2 flex-wrap mt-1">
                        {comment.attachments.map((att) => {
                          const url = signedUrlMap.get(att.storage_path)
                          return url ? (
                            <a
                              key={att.id}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt={att.file_name}
                                className="w-16 h-16 object-cover rounded border border-border hover:opacity-80 transition-opacity cursor-pointer"
                              />
                            </a>
                          ) : (
                            <div
                              key={att.id}
                              className="w-16 h-16 rounded border border-border bg-muted flex items-center justify-center text-xs text-muted-foreground"
                            >
                              {att.file_name.slice(0, 6)}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
              {/* 수정/삭제 버튼 - 본인 댓글만 */}
              {currentUserId === comment.author?.id && editingId !== comment.id && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 relative after:absolute after:-inset-2 after:content-['']"
                    onClick={() => startEdit(comment)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-destructive relative after:absolute after:-inset-2 after:content-['']"
                    onClick={() => handleDelete(comment.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 새 댓글 입력 */}
      <div
        className={cn(
          'space-y-2 rounded-md transition-colors',
          isDraggingOver && 'ring-2 ring-primary ring-offset-1'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPaste={handlePaste}
      >
        <div className="flex gap-2">
          <MentionTextarea
            value={newComment}
            onChange={setNewComment}
            members={members}
            placeholder="댓글을 입력하세요... (@로 멘션)"
            className="h-[60px] text-sm"
            onSubmit={handleSubmit}
          />
          <div className="flex flex-col gap-1 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void handleFileUpload(e.target.files)
                e.target.value = ''
              }}
            />
            <Button
              size="icon"
              variant="outline"
              className="h-[28px] w-[28px]"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="이미지 첨부"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              className="h-[28px] w-[28px]"
              onClick={handleSubmit}
              disabled={(!newComment.trim() && pendingAttachments.length === 0) || isSubmitting}
              title="댓글 작성"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* 첨부 미리보기 */}
        {(pendingAttachments.length > 0 || uploadingFiles.length > 0) && (
          <div className="flex gap-2 flex-wrap px-1">
            {pendingAttachments.map((att) => {
              const url = signedUrlMap.get(att.storage_path)
              return (
                <div key={att.id} className="relative group/img">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={att.file_name}
                      className="w-16 h-16 object-cover rounded border border-border"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded border border-border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                      {att.file_name.slice(0, 6)}
                    </div>
                  )}
                  <button
                    type="button"
                    className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                    onClick={() =>
                      setPendingAttachments((prev) => prev.filter((a) => a.id !== att.id))
                    }
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              )
            })}
            {uploadingFiles.map((u) => (
              <div
                key={u.id}
                className="relative w-16 h-16 rounded border border-border overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={u.objectUrl}
                  alt={u.name}
                  className="w-full h-full object-cover opacity-40"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Ctrl+Enter로 댓글 작성 | @로 멘션 | 이미지 붙여넣기/드래그 가능
      </p>
    </div>
  )
}
