export {}

declare global {
  interface ConfirmDialogOptions {
    title: string
    description?: string
    actionLabel?: string
    cancelLabel?: string
    variant?: 'default' | 'destructive'
  }

  interface Window {
    __confirmAsync?: (options: ConfirmDialogOptions) => Promise<boolean>
    __nativeConfirm?: (message?: string) => boolean
  }
}
