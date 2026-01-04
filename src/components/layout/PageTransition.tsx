import { ReactNode } from "react";

interface PageTransitionProps {
    children: ReactNode;
    className?: string;
}

/**
 * 페이지 전환 애니메이션을 적용하는 래퍼 컴포넌트입니다.
 * Framer Motion 제거 후 CSS 애니메이션으로 대체.
 */
export const PageTransition = ({ children, className = "" }: PageTransitionProps) => {
    return (
        <div className={`page-transition ${className}`}>
            {children}
        </div>
    );
};
