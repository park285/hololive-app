import { useState } from 'react';
import { Search } from 'lucide-react';
import { BaseModal } from '@/components/ui/BaseModal';
import { Input } from '@/components/ui/Input';
import { useLiveStreams } from '@/hooks/useHoloQueries';
import type { VideoSource } from '@/types/multiview';
import type { Stream } from '@/types';

interface VideoSelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (videoId: string, source: VideoSource) => void;
}

export function VideoSelectorDialog({
    open,
    onOpenChange,
    onSelect,
}: VideoSelectorDialogProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const { data: streams, isLoading } = useLiveStreams();

    const filteredStreams = streams?.filter(stream =>
        stream.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stream.channelName.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    const handleSelect = (stream: Stream) => {
        // 현재는 YouTube만 지원. URL이 없는 경우 ID로 fallback
        const videoId = stream.link?.replace('https://www.youtube.com/watch?v=', '') || stream.id;
        onSelect(videoId, 'youtube');
    };

    return (
        <BaseModal
            isOpen={open}
            onClose={() => onOpenChange(false)}
            title="스트림 선택"
            maxWidth="2xl"
            showHeaderBorder
        >
            <div className="space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="방송 제목 또는 채널명 검색..."
                        className="pl-9"
                    />
                </div>

                <div className="h-[400px] overflow-y-auto pr-2 -mr-2">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            로딩 중...
                        </div>
                    ) : filteredStreams.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            방송 중인 스트림이 없습니다.
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            {filteredStreams.map((stream) => (
                                <button
                                    key={stream.id}
                                    onClick={() => handleSelect(stream)}
                                    className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-accent/50"
                                >
                                    <div className="aspect-video w-full overflow-hidden rounded-md bg-muted relative">
                                        <img
                                            src={stream.thumbnail}
                                            alt={stream.title}
                                            className="h-full w-full object-cover"
                                            loading="lazy"
                                        />
                                        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">
                                            LIVE
                                        </div>
                                    </div>
                                    <div className="space-y-1 overflow-hidden">
                                        <h4 className="font-medium text-sm truncate" title={stream.title}>
                                            {stream.title}
                                        </h4>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            {stream.channel?.photo ? (
                                                <img
                                                    src={stream.channel.photo}
                                                    alt={stream.channelName}
                                                    className="h-5 w-5 rounded-full"
                                                />
                                            ) : (
                                                <div className="h-5 w-5 rounded-full bg-muted" />
                                            )}
                                            <span className="truncate">{stream.channelName}</span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </BaseModal>
    );
}
