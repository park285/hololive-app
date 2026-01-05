import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMultiviewStore, useCellPlayerState } from '@/stores/multiviewStore';

interface YouTubePlayerProps {
    cellId: string;
    videoId: string;
}

// YouTube IFrame API Minimal Type Definitions
declare global {
    interface Window {
        YT: typeof YT;
        onYouTubeIframeAPIReady?: () => void;
    }
}

declare namespace YT {
    class Player {
        constructor(element: HTMLElement | null, options: PlayerOptions);
        destroy(): void;
        mute(): void;
        unMute(): void;
        setVolume(volume: number): void;
        getIframe(): HTMLIFrameElement;
    }

    interface PlayerOptions {
        videoId: string;
        playerVars?: PlayerVars;
        events?: Events;
    }

    interface PlayerVars {
        autoplay?: number;
        playsinline?: number;
        rel?: number;
        modestbranding?: number;
        controls?: number;
        disablekb?: number;
        fs?: number;
        loop?: number;
    }

    interface Events {
        onReady?: (event: PlayerEvent) => void;
        onStateChange?: (event: OnStateChangeEvent) => void;
        onError?: (event: PlayerEvent) => void;
    }

    interface PlayerEvent {
        target: Player;
        data?: any;
    }

    interface OnStateChangeEvent extends PlayerEvent {
        data: number;
    }

    enum PlayerState {
        UNSTARTED = -1,
        ENDED = 0,
        PLAYING = 1,
        PAUSED = 2,
        BUFFERING = 3,
        CUED = 5,
    }
}

// API 로드 상태 추적
let apiLoaded = false;
let apiLoading = false;
const apiReadyCallbacks: (() => void)[] = [];

function loadYouTubeAPI(): Promise<void> {
    if (apiLoaded) return Promise.resolve();

    return new Promise((resolve) => {
        if (apiLoading) {
            apiReadyCallbacks.push(resolve);
            return;
        }

        apiLoading = true;
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);

        window.onYouTubeIframeAPIReady = () => {
            apiLoaded = true;
            apiLoading = false;
            resolve();
            apiReadyCallbacks.forEach(cb => cb());
            apiReadyCallbacks.length = 0;
        };
    });
}

export function YouTubePlayer({ cellId, videoId }: YouTubePlayerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YT.Player | null>(null);

    const playerState = useCellPlayerState(cellId);
    const { setPlayerState, muteOthers, muteOthersEnabled } = useMultiviewStore(
        useShallow((state) => ({
            setPlayerState: state.setPlayerState,
            muteOthers: state.muteOthers,
            muteOthersEnabled: state.muteOthersEnabled,
        }))
    );

    // 플레이어 초기화
    useEffect(() => {
        let mounted = true;

        const initPlayer = async () => {
            await loadYouTubeAPI();
            if (!mounted || !containerRef.current) return;

            // 이미 플레이어가 있으면 파괴
            if (playerRef.current) {
                playerRef.current.destroy();
            }

            playerRef.current = new window.YT.Player(containerRef.current, {
                videoId,
                playerVars: {
                    autoplay: 1,
                    playsinline: 1,
                    rel: 0,
                    modestbranding: 1,
                },
                events: {
                    onReady: (event) => {
                        // 초기 음소거 설정
                        if (mounted) {
                            event.target.mute();
                            setPlayerState(cellId, { muted: true, playing: true });
                        }
                    },
                    onStateChange: (event) => {
                        if (!mounted) return;
                        const isPlaying = event.data === window.YT.PlayerState.PLAYING;
                        setPlayerState(cellId, { playing: isPlaying });

                        // 재생 시작 시 다른 셀 음소거
                        if (isPlaying && muteOthersEnabled) {
                            muteOthers(cellId);
                        }
                    },
                },
            });
        };

        initPlayer();

        return () => {
            mounted = false;
            playerRef.current?.destroy();
            playerRef.current = null;
        };
    }, [videoId, cellId]); // setPlayerState, muteOthers, muteOthersEnabled are stable

    // 음소거 상태 동기화
    useEffect(() => {
        if (!playerRef.current || !playerRef.current.mute) return;

        if (playerState?.muted) {
            playerRef.current.mute();
        } else {
            playerRef.current.unMute();
        }
    }, [playerState?.muted]);

    // 볼륨 동기화
    useEffect(() => {
        if (!playerRef.current || !playerRef.current.setVolume || playerState?.volume === undefined) return;
        playerRef.current.setVolume(playerState.volume);
    }, [playerState?.volume]);

    return (
        <div className="youtube-player h-full w-full bg-black">
            <div ref={containerRef} className="h-full w-full" />
        </div>
    );
}
