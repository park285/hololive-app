import { Skeleton } from '@/components/ui/Skeleton';

export function MultiviewSkeleton() {
    return (
        <div className="flex flex-col h-full w-full p-4 gap-4">
            {/* Toolbar Skeleton */}
            <div className="flex justify-between items-center h-14 border-b pb-2">
                <Skeleton className="h-9 w-32 rounded-lg" />
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-24 rounded-lg" />
                    <Skeleton className="h-9 w-9 rounded-lg" />
                </div>
            </div>

            {/* Grid Skeleton (3x4 Layout - Doubled Width) */}
            <div className="grid grid-cols-3 grid-rows-4 gap-4 h-full">
                {[...Array(12)].map((_, i) => (
                    <Skeleton key={i} className="w-full rounded-xl" />
                ))}
            </div>
        </div>
    );
}
