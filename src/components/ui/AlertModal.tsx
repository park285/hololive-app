import { BaseModal } from './BaseModal'
import { CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'

export type AlertType = 'success' | 'error' | 'warning' | 'info'

interface AlertModalProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    message: React.ReactNode
    type?: AlertType
    confirmText?: string
    cancelText?: string
    onConfirm?: () => void
    showCancel?: boolean
}

const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
}

const colors = {
    success: 'text-green-500 bg-green-500/10',
    error: 'text-destructive bg-destructive/10',
    warning: 'text-yellow-500 bg-yellow-500/10',
    info: 'text-blue-500 bg-blue-500/10',
}

export const AlertModal = ({
    isOpen,
    onClose,
    title,
    message,
    type = 'info',
    confirmText,
    cancelText,
    onConfirm,
    showCancel = false,
}: AlertModalProps) => {
    const { t } = useTranslation()
    const Icon = icons[type]

    const handleConfirm = () => {
        if (onConfirm) {
            onConfirm()
        }
        onClose()
    }

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            maxWidth="sm"
            titleClassName="text-center"
        >
            <div className="flex flex-col items-center text-center space-y-4">
                {/* Icon */}
                <div className={clsx('p-3 rounded-full', colors[type])}>
                    <Icon className="w-8 h-8" />
                </div>

                {/* Content */}
                <div className="space-y-2">
                    {title && (
                        <h3 className="text-lg font-bold text-foreground">
                            {title}
                        </h3>
                    )}
                    <div className="text-muted-foreground text-sm leading-relaxed">
                        {message}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 w-full mt-6">
                    {showCancel && (
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground transition-colors text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                        >
                            {cancelText || t('common.cancel', '취소')}
                        </button>
                    )}
                    <button
                        onClick={handleConfirm}
                        className={clsx(
                            'flex-1 px-4 py-2.5 rounded-xl text-white transition-all text-sm font-medium shadow-lg shadow-primary/20 focus:ring-2 focus:ring-primary/20 outline-none hover:scale-[1.02] active:scale-[0.98]',
                            type === 'error'
                                ? 'bg-destructive hover:bg-destructive/90 shadow-destructive/20'
                                : 'bg-primary hover:bg-primary/90'
                        )}
                    >
                        {confirmText || t('common.confirm', '확인')}
                    </button>
                </div>
            </div>
        </BaseModal>
    )
}
