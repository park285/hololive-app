import { useEffect, useState } from 'react';
import { useMultiviewStore, useMultiviewStatus } from '@/stores/multiviewStore';
import { PlayerPoolProvider } from '@/hooks/usePlayerPool';
import { MultiviewToolbar } from './MultiviewToolbar';
import { MultiviewGrid } from './MultiviewGrid';
import { MultiviewSkeleton } from './MultiviewSkeleton';
import { AlertCircle } from 'lucide-react';

function ErrorToast({ message }: { message: string }) {
    const clearError = useMultiviewStore(state => state.clearError);
    return (
        <div className="absolute bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-destructive-foreground shadow-lg animate-in slide-in-from-bottom-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{message}</span>
            <button onClick={clearError} className="ml-2 hover:opacity-80">
                &times;
            </button>
        </div>
    );
}

export default function MultiviewPage() {
    const loadState = useMultiviewStore(state => state.loadState);
    const { isLoading, error } = useMultiviewStatus();

    // 모바일 편집 모드 상태 (Toolbar <-> Grid 동기화를 위해 페이지 레벨에서 관리)
    const [isEditMode, setIsEditMode] = useState(false);

    // 페이지 진입 시 저장된 레이아웃 로드
    useEffect(() => {
        loadState();
    }, [loadState]);

    // 페이지 이탈 시 자동 저장
    useEffect(() => {
        const handleBeforeUnload = () => {
            useMultiviewStore.getState().saveState();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    if (isLoading) {
        return <MultiviewSkeleton />;
    }

    return (
        <PlayerPoolProvider>
            <div className="flex flex-col h-full relative">
                <MultiviewToolbar
                    isEditMode={isEditMode}
                    onEditModeChange={setIsEditMode}
                />
                <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
                    <MultiviewGrid isEditMode={isEditMode} />
                </div>
                {error && <ErrorToast message={error} />}
            </div>
        </PlayerPoolProvider>
    );
}
