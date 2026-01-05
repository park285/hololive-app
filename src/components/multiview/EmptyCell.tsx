import { Plus, Link2, Youtube } from 'lucide-react';
import { useState } from 'react';
import { useMultiviewStore } from '@/stores/multiviewStore';
import { VideoSelectorDialog } from './VideoSelectorDialog';
import type { VideoSource } from '@/types/multiview';
import { useTranslation } from 'react-i18next';

interface EmptyCellProps {
    cellId: string;
}

// YouTube URL에서 Video ID 추출
function extractYouTubeId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/, // 직접 ID 입력
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

export function EmptyCell({ cellId }: EmptyCellProps) {
    const { t } = useTranslation();
    const [showSelector, setShowSelector] = useState(false);
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [urlInput, setUrlInput] = useState('');
    const [urlError, setUrlError] = useState('');
    const updateCellContent = useMultiviewStore(state => state.updateCellContent);

    const handleVideoSelect = (videoId: string, source: VideoSource) => {
        updateCellContent(cellId, {
            type: 'video',
            videoId,
            videoSource: source,
        });
        setShowSelector(false);
    };

    const handleUrlSubmit = () => {
        const videoId = extractYouTubeId(urlInput.trim());
        if (videoId) {
            handleVideoSelect(videoId, 'youtube');
            setUrlInput('');
            setShowUrlInput(false);
            setUrlError('');
        } else {
            setUrlError(t('multiview.invalidUrl'));
        }
    };

    // URL 입력 모드
    if (showUrlInput) {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center p-6 bg-card/50 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
                <div className="w-full max-w-[280px] space-y-4">
                    <div className="text-center space-y-1.5">
                        <div className="mx-auto w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-2">
                            <Youtube className="w-5 h-5 text-red-500" />
                        </div>
                        <h4 className="font-semibold text-foreground">{t('multiview.youtubeUrlTitle')}</h4>
                        <p className="text-xs text-muted-foreground">{t('multiview.youtubeUrlDesc')}</p>
                    </div>

                    <div className="space-y-2">
                        <input
                            type="text"
                            value={urlInput}
                            onChange={(e) => {
                                setUrlInput(e.target.value);
                                setUrlError('');
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUrlSubmit();
                                if (e.key === 'Escape') setShowUrlInput(false);
                            }}
                            placeholder="https://youtube.com/watch?v=..."
                            className="w-full px-4 py-2.5 text-sm rounded-xl border border-border/50 bg-background/50 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/50 transition-all placeholder:text-muted-foreground/50"
                            autoFocus
                        />
                        {urlError && (
                            <p className="text-[11px] font-medium text-red-500 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-red-500" />
                                {urlError}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                        <button
                            onClick={() => setShowUrlInput(false)}
                            className="px-4 py-2 text-xs font-medium rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                        >
                            {t('multiview.cancel')}
                        </button>
                        <button
                            onClick={handleUrlSubmit}
                            disabled={!urlInput.trim()}
                            className="px-4 py-2 text-xs font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/20 transition-all hover:shadow-red-500/30"
                        >
                            {t('multiview.confirm')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // 기본 상태: 옵션 선택
    return (
        <>
            <div className="group flex h-full w-full flex-col items-center justify-center gap-6 p-6 bg-card/30 hover:bg-card/50 backdrop-blur-[2px] transition-all duration-300">
                {/* 메인 아이콘/텍스트 - 클릭 시 목록 선택 다이얼로그 열기 */}
                <button
                    onClick={() => setShowSelector(true)}
                    className="flex flex-col items-center gap-3 transition-transform duration-300 group-hover:-translate-y-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500/50 rounded-2xl p-2"
                    aria-label={t('multiview.addStream')}
                >
                    <div className="relative">
                        <div className="absolute inset-0 rounded-2xl bg-sky-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-background to-muted border border-border/50 shadow-sm flex items-center justify-center group-hover:scale-110 group-hover:border-sky-500/30 group-hover:shadow-[0_0_20px_-5px_rgba(14,165,233,0.3)] transition-all duration-300">
                            <Plus className="h-7 w-7 text-muted-foreground/70 group-hover:text-sky-500 transition-colors duration-300" />
                        </div>
                    </div>
                    <div className="text-center space-y-1">
                        <span className="text-sm font-semibold text-foreground/80 group-hover:text-foreground transition-colors">
                            {t('multiview.addStream')}
                        </span>
                        <p className="text-[11px] text-muted-foreground/70 opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-y-2 group-hover:translate-y-0">
                            {t('multiview.addStreamHint')}
                        </p>
                    </div>
                </button>

                {/* 액션 버튼 그룹 */}
                <div className="w-full max-w-[240px] opacity-90 hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => setShowUrlInput(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-background/50 hover:bg-background border border-border/50 hover:border-border transition-all duration-200 group/btn"
                    >
                        <Link2 className="h-4 w-4 text-muted-foreground group-hover/btn:text-foreground transition-colors" />
                        <span className="text-xs font-medium text-muted-foreground group-hover/btn:text-foreground">{t('multiview.enterUrl')}</span>
                    </button>
                </div>
            </div>

            <VideoSelectorDialog
                open={showSelector}
                onOpenChange={setShowSelector}
                onSelect={handleVideoSelect}
            />
        </>
    );
}
