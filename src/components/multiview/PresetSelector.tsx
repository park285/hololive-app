import { useMultiviewStore } from '@/stores/multiviewStore';
import { BUILTIN_PRESETS } from '@/data/presets';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function PresetSelector() {
    const { t } = useTranslation();
    const applyPreset = useMultiviewStore(state => state.applyPresetLayout);
    const activePresetId = useMultiviewStore(state => state.activePresetId);

    const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const presetId = e.target.value;
        const preset = BUILTIN_PRESETS.find(p => p.id === presetId);
        if (preset) {
            applyPreset(preset);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <div className="relative">
                <select
                    className="h-9 w-[200px] appearance-none rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    onChange={handleSelect}
                    value={activePresetId || ""}
                >
                    <option value="" disabled>{t('multiview.selectPreset')}</option>
                    {BUILTIN_PRESETS.map(preset => (
                        <option key={preset.id} value={preset.id}>
                            {preset.name} ({preset.videoCellCount} cells)
                        </option>
                    ))}
                </select>
                <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 opacity-50 pointer-events-none" />
            </div>
        </div>
    );
}
