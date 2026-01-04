import { useTranslation } from "react-i18next";
import { Member } from "@/types";
import { cn } from "@/lib/utils";
import { getOptimizedProfileImage } from "@/lib/imageOptimizer";
import { Bell, BellOff } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
// NOTE: Radix 등 UI 컴포넌트 의존성을 줄이기 위해 표준 HTML 요소와 `cn` 유틸리티를 사용함

interface MemberCardProps {
    member: Member;
    isAlarmEnabled?: boolean;
    onToggleAlarm?: (member: Member) => void;
    className?: string;
}

/**
 * 언어에 따라 멤버 이름을 반환하는 헬퍼 함수
 */
function getMemberDisplayName(member: Member, language: string): string {
    switch (language) {
        case 'ko':
            return member.nameKo || member.name;
        case 'ja':
            return member.nameJa || member.name;
        default: // 'en' or fallback
            return member.name || member.nameKo || member.nameJa || '';
    }
}

/**
 * 멤버 정보를 카드 형태로 표시하는 컴포넌트입니다.
 * 프로필 사진, 이름, 그룹 정보와 함께 알람 토글 버튼을 제공합니다.
 * @param member - 표시할 멤버 데이터
 * @param isAlarmEnabled - 알람 활성화 여부
 * @param onToggleAlarm - 알람 토글 콜백 함수
 * @param className - 추가 CSS 클래스
 */
export function MemberCard({ member, isAlarmEnabled, onToggleAlarm, className }: MemberCardProps) {
    const { t, i18n } = useTranslation();

    // 현재 언어에 따라 이름 표시
    const displayName = getMemberDisplayName(member, i18n.language);

    // YouTube 채널 페이지 URL
    const channelUrl = `https://www.youtube.com/channel/${member.channelId}`;

    // 프로필 이미지 클릭 시 YouTube 채널 열기
    const handleImageClick = async () => {
        await openUrl(channelUrl);
    };

    return (
        <div
            className={cn(
                "flex flex-col items-center p-4 rounded-xl border bg-card shadow-sm hover:shadow-md transition-all",
                className
            )}
        >
            <div className="relative mb-3">
                <img
                    src={getOptimizedProfileImage(member.photo, 80)}
                    alt={displayName}
                    className={cn(
                        "w-20 h-20 rounded-full border-2 object-cover bg-muted cursor-pointer member-card-image",
                        isAlarmEnabled ? "border-primary ring-2 ring-primary/20" : "border-border grayscale-[0.1]"
                    )}
                    loading="lazy"
                    decoding="async"
                    onClick={handleImageClick}
                    onError={(e) => {
                        // 최적화 실패 시 원본 URL로 fallback
                        if (member.photo && e.currentTarget.src !== member.photo) {
                            e.currentTarget.src = member.photo;
                        }
                    }}
                />
                {member.graduated && (
                    <span className="absolute -bottom-1 right-0 bg-neutral-600 text-[10px] text-white px-2 py-0.5 rounded-full border border-white">
                        {t('members.graduated')}
                    </span>
                )}
            </div>

            <h3 className="font-semibold text-center text-sm truncate w-full px-1" title={displayName}>
                {displayName}
            </h3>
            <p className="text-xs text-muted-foreground mb-4 truncate max-w-full">
                {member.group || "Hololive"}
            </p>

            <button
                onClick={() => onToggleAlarm?.(member)}
                className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 active:scale-95",
                    isAlarmEnabled
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
            >
                {isAlarmEnabled ? (
                    <>
                        <Bell className="w-3.5 h-3.5 fill-current" />
                        <span>{t('members.alarmOn')}</span>
                    </>
                ) : (
                    <>
                        <BellOff className="w-3.5 h-3.5" />
                        <span>{t('members.alarmOff')}</span>
                    </>
                )}
            </button>
        </div>
    );
}
