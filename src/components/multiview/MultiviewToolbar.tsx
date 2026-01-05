import { Plus, RotateCcw, Save, Volume2, VolumeX, Grid3X3, Menu, ChevronDown, Maximize, Smartphone, Tablet, Monitor, Pencil, Check } from 'lucide-react';
import { useMultiviewStore, useMultiviewLayout } from '@/stores/multiviewStore';
import { Button } from '@/components/ui/Button';
import { PresetSelector } from './PresetSelector';
import { useState } from 'react';
import { BaseModal } from '@/components/ui/BaseModal';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { PLAYER_POOL_CONFIG } from '@/types/multiview';

import { usePlayerPoolContext } from '@/hooks/usePlayerPool';
import { useSidebarStore } from '@/stores/sidebarStore';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useTranslation } from 'react-i18next';

interface MultiviewToolbarProps {
    /** 모바일 편집 모드 상태 */
    isEditMode: boolean;
    /** 모바일 편집 모드 토글 콜백 */
    onEditModeChange: (mode: boolean) => void;
}

export function MultiviewToolbar({ isEditMode, onEditModeChange }: MultiviewToolbarProps) {
    const { t } = useTranslation();
    const addCell = useMultiviewStore(state => state.addCell);
    const reset = useMultiviewStore(state => state.reset);
    const saveAsPreset = useMultiviewStore(state => state.saveAsPreset);
    const muteOthersEnabled = useMultiviewStore(state => state.muteOthersEnabled);
    const toggleMuteOthersMode = useMultiviewStore(state => state.toggleMuteOthersMode);
    const layout = useMultiviewLayout();

    const { activeCount } = usePlayerPoolContext();
    const { setSidebarOpen } = useSidebarStore();
    const isMobile = useIsMobile();

    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const [presetName, setPresetName] = useState('');

    const handleSavePreset = () => {
        if (!presetName.trim()) return;
        saveAsPreset(presetName);
        setPresetName('');
        setIsSaveModalOpen(false);
    };

    const cellCount = layout.length;
    const maxPlayers = PLAYER_POOL_CONFIG.MAX_ACTIVE_PLAYERS;

    return (
        <div className="flex h-20 items-center justify-between border-b border-slate-200/50 dark:border-border/50 bg-white/60 dark:bg-background/60 backdrop-blur-md px-6 sm:px-8 sticky top-0 z-20 transition-all duration-300">
            {/* 좌측: 타이틀 (Standard Header Style) */}
            <div className="flex items-center gap-4">
                {/* 모바일 사이드바 토글 (Layout.tsx와 디자인 통일) */}
                {isMobile && (
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                    >
                        <Menu size={20} />
                    </button>
                )}

                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-foreground tracking-tight">
                        {t('multiview.title')}
                    </h2>
                    <p className="text-xs text-slate-400 dark:text-muted-foreground font-medium mt-0.5 hidden sm:block">
                        Unified Bot Management System
                    </p>
                </div>
            </div>

            {/* 우측: 툴바 컨트롤 모음 */}
            <div className="flex items-center gap-3">
                {/* 셀 카운터 */}
                <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
                    <Grid3X3 className="h-3.5 w-3.5" />
                    <span>{t('multiview.cellCount', { count: cellCount })}</span>
                    <span className="text-border">|</span>
                    <span className={cn(
                        "font-medium",
                        activeCount >= maxPlayers ? "text-amber-500" : "text-sky-500"
                    )}>
                        {t('multiview.activeCount', { active: activeCount, max: maxPlayers })}
                    </span>
                </div>

                <div className="h-5 w-px bg-border/60 hidden md:block" />

                {/* 셀 추가 & 음소거 */}
                <div className="flex items-center gap-2">
                    {/* 셀 추가 버튼 (Split Button) */}
                    <div className="relative flex items-center">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addCell()}
                            className="h-8 pl-3 pr-2 gap-1.5 text-xs rounded-r-none border-r-0"
                            title={t('multiview.addAutoDesc')}
                        >
                            <Plus className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{t('multiview.addCell')}</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                            className="h-8 px-1.5 rounded-l-none hover:bg-muted/50"
                        >
                            <ChevronDown className="h-3.5 w-3.5" />
                        </Button>

                        {isAddMenuOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setIsAddMenuOpen(false)}
                                />
                                <div className="absolute top-full right-0 sm:left-0 mt-2 w-56 bg-white/80 dark:bg-card/90 backdrop-blur-xl text-popover-foreground border border-white/20 dark:border-border/50 rounded-xl shadow-xl shadow-black/5 z-50 py-1.5 animate-in fade-in zoom-in-95 duration-200 ring-1 ring-black/5">
                                    <button
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground flex items-center gap-2 transition-colors"
                                        onClick={() => { addCell(); setIsAddMenuOpen(false); }}
                                    >
                                        <Maximize className="h-3.5 w-3.5 text-muted-foreground" />
                                        <div>
                                            <div className="font-medium">{t('multiview.addAuto')}</div>
                                            <div className="text-[10px] text-muted-foreground">{t('multiview.addAutoDesc')}</div>
                                        </div>
                                    </button>
                                    <div className="h-px bg-border my-1" />
                                    <button
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground flex items-center gap-2 transition-colors"
                                        onClick={() => { addCell({ w: 2, h: 2 }, { maxCount: 64 }); setIsAddMenuOpen(false); }}
                                    >
                                        <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                                        <div>
                                            <div className="font-medium">{t('multiview.addSmall')}</div>
                                            <div className="text-[10px] text-muted-foreground">{t('multiview.addSmallDesc')}</div>
                                        </div>
                                    </button>
                                    <button
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground flex items-center gap-2 transition-colors"
                                        onClick={() => { addCell({ w: 4, h: 3 }, { maxCount: 24 }); setIsAddMenuOpen(false); }}
                                    >
                                        <Tablet className="h-3.5 w-3.5 text-muted-foreground" />
                                        <div>
                                            <div className="font-medium">{t('multiview.addMedium')}</div>
                                            <div className="text-[10px] text-muted-foreground">{t('multiview.addMediumDesc')}</div>
                                        </div>
                                    </button>
                                    <button
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground flex items-center gap-2 transition-colors"
                                        onClick={() => { addCell({ w: 6, h: 5 }, { maxCount: 16 }); setIsAddMenuOpen(false); }}
                                    >
                                        <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                                        <div>
                                            <div className="font-medium">{t('multiview.addLarge')}</div>
                                            <div className="text-[10px] text-muted-foreground">{t('multiview.addLargeDesc')}</div>
                                        </div>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {/* 자동 음소거 토글 */}
                    <Button
                        variant={muteOthersEnabled ? "default" : "ghost"}
                        size="sm"
                        onClick={toggleMuteOthersMode}
                        title={muteOthersEnabled ? t('multiview.muteOn') : t('multiview.muteOff')}
                        className={cn(
                            "h-8 w-8 p-0",
                            muteOthersEnabled && "bg-sky-500 hover:bg-sky-600"
                        )}
                    >
                        {muteOthersEnabled ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>

                    {/* Mobile Edit Mode Toggle */}
                    {isMobile && (
                        <Button
                            variant={isEditMode ? "default" : "outline"}
                            size="sm"
                            onClick={() => onEditModeChange(!isEditMode)}
                            className={cn(
                                "h-8 px-3 gap-1.5 text-xs font-medium transition-all",
                                isEditMode
                                    ? "bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white border-none shadow-lg shadow-sky-500/25"
                                    : "border-sky-300 dark:border-sky-700 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/30"
                            )}
                        >
                            {isEditMode ? (
                                <>
                                    <Check className="h-3.5 w-3.5" />
                                    <span>{t('multiview.editDone')}</span>
                                </>
                            ) : (
                                <>
                                    <Pencil className="h-3.5 w-3.5" />
                                    <span>{t('multiview.editMode')}</span>
                                </>
                            )}
                        </Button>
                    )}
                </div>

                <div className="h-5 w-px bg-border/60 hidden sm:block" />

                {/* 프리셋 & 저장 */}
                <div className="flex items-center gap-2">
                    <PresetSelector />

                    <div className="hidden sm:flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsSaveModalOpen(true)}
                            title={t('multiview.savePreset')}
                            className="h-8 w-8 p-0"
                        >
                            <Save className="h-4 w-4" />
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={reset}
                            title={t('multiview.addAutoDesc')}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* 프리셋 저장 모달 */}
            <BaseModal
                isOpen={isSaveModalOpen}
                onClose={() => setIsSaveModalOpen(false)}
                title={t('multiview.savePreset')}
                maxWidth="sm"
            >
                <div className="space-y-4 pt-2">
                    <p className="text-sm text-muted-foreground">
                        {t('multiview.savePresetDesc', { count: cellCount })}
                    </p>
                    <Input
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        placeholder={t('multiview.presetNamePlaceholder')}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSavePreset();
                        }}
                        autoFocus
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsSaveModalOpen(false)}>{t('multiview.cancel')}</Button>
                        <Button onClick={handleSavePreset} disabled={!presetName.trim()}>{t('multiview.save')}</Button>
                    </div>
                </div>
            </BaseModal>
        </div>
    );
}
