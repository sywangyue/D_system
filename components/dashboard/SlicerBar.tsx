"use client";

interface SlicerBarProps {
  // Industry L1 — 切片器按钮组
  industryL1Options: string[];
  selectedL1: string | null;
  onL1Change: (value: string | null) => void;

  // Industry L2 — 展开面板中的多选标签
  industryL2Options: string[];
  selectedL2: string | null;
  onL2Change: (value: string | null) => void;

  // Competition relation — 多选
  competitionRelationOptions: string[];
  selectedRelations: string[];
  onRelationsChange: (values: string[]) => void;

  // MDS related — 单选
  mdsRelatedOptions: string[];
  selectedMds: string | null;
  onMdsChange: (value: string | null) => void;

  isLoading?: boolean;
}

const ALL = "全部";

function SlicerButton({
  label,
  isSelected,
  onClick,
  disabled,
}: {
  label: string;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-9 px-4 text-sm cursor-pointer font-medium transition-colors duration-150
        ${
          isSelected
            ? "bg-accent text-white shadow-sm"
            : "bg-white border border-border text-text-primary hover:bg-accent-surface hover:border-accent/30"
        }
        focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1
      `}
      style={{ borderRadius: "var(--radius-sm)" }}
    >
      {label}
    </button>
  );
}

function TagPill({
  label,
  isSelected,
  onClick,
  disabled,
}: {
  label: string;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-7 px-3 text-sm cursor-pointer transition-colors duration-150
        ${
          isSelected
            ? "bg-accent-surface border border-accent/60 text-accent-dark font-medium"
            : "bg-white border border-border text-text-secondary hover:bg-gray-50"
        }
        focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1
      `}
      style={{ borderRadius: "var(--radius-md)" }}
    >
      {label}
    </button>
  );
}

function WeakPill({
  label,
  isSelected,
  onClick,
  disabled,
}: {
  label: string;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-6 px-2.5 text-xs cursor-pointer transition-colors duration-150
        ${
          isSelected
            ? "bg-accent-surface border border-accent/40 text-accent-dark font-medium"
            : "bg-white border border-border text-text-secondary hover:bg-gray-50"
        }
        focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1
      `}
      style={{ borderRadius: "var(--radius-sm)" }}
    >
      {label}
    </button>
  );
}

export default function SlicerBar({
  industryL1Options,
  selectedL1,
  onL1Change,
  industryL2Options,
  selectedL2,
  onL2Change,
  competitionRelationOptions,
  selectedRelations,
  onRelationsChange,
  mdsRelatedOptions,
  selectedMds,
  onMdsChange,
  isLoading = false,
}: SlicerBarProps) {
  const hasActiveL1 = selectedL1 !== null;
  const isAllRelations = selectedRelations.length === 0;
  const isAllMds = selectedMds === null;

  // L1: rectangular slicer buttons
  const handleL1Click = (value: string) => {
    if (value === ALL) {
      onL1Change(null);
      onL2Change(null);
    } else if (value === selectedL1) {
      // Deselect (toggle off)
      onL1Change(null);
      onL2Change(null);
    } else {
      onL1Change(value);
      onL2Change(null);
    }
  };

  // L2: pill tags in expanded panel
  const handleL2Click = (value: string) => {
    if (value === selectedL2) {
      onL2Change(null);
    } else {
      onL2Change(value);
    }
  };

  // Competition relation: multi-select
  const handleRelationClick = (value: string) => {
    if (value === ALL) {
      onRelationsChange([]);
    } else {
      const current = selectedRelations.filter((r) => r !== ALL);
      if (current.includes(value)) {
        const next = current.filter((r) => r !== value);
        onRelationsChange(next.length === 0 ? [] : next);
      } else {
        const next = [...current, value];
        onRelationsChange(next);
      }
    }
  };

  // MDS: single-select
  const handleMdsClick = (value: string) => {
    if (value === ALL) {
      onMdsChange(null);
    } else {
      onMdsChange(value);
    }
  };

  return (
    <div
      className="sticky top-0 z-10 bg-white border-b border-border"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <div className="px-6 py-3 space-y-3">
        {/* Row 1: L1 Slicer buttons — Excel 切片器风格 */}
        <div className="flex items-center gap-1 flex-wrap">
          {isLoading && industryL1Options.length === 0 ? (
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-9 w-16 bg-gray-200 animate-pulse"
                  style={{ borderRadius: "var(--radius-sm)" }}
                />
              ))}
            </div>
          ) : (
            <>
              {/* "全部" slicer button */}
              <SlicerButton
                key={ALL}
                label={ALL}
                isSelected={!hasActiveL1}
                onClick={() => handleL1Click(ALL)}
                disabled={isLoading}
              />
              {industryL1Options.map((opt) => (
                <SlicerButton
                  key={opt}
                  label={opt}
                  isSelected={selectedL1 === opt}
                  onClick={() => handleL1Click(opt)}
                  disabled={isLoading}
                />
              ))}
            </>
          )}
        </div>

        {/* Row 1b: L2 expanded panel — 手风琴风格 */}
        {hasActiveL1 && (
          <div
            className="p-3 bg-gray-50 border border-border"
            style={{ borderRadius: "var(--radius-md)" }}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-text-secondary mr-1">
                二级分类
              </span>
              <TagPill
                key={ALL + "-l2"}
                label="全部"
                isSelected={selectedL2 === null}
                onClick={() => onL2Change(null)}
                disabled={isLoading}
              />
              {industryL2Options.map((opt) => (
                <TagPill
                  key={opt}
                  label={opt}
                  isSelected={selectedL2 === opt}
                  onClick={() => handleL2Click(opt)}
                  disabled={isLoading}
                />
              ))}
              {industryL2Options.length === 0 && !isLoading && (
                <span className="text-xs text-gray-400">暂无二级分类</span>
              )}
            </div>
          </div>
        )}

        {/* Row 2: 竞争关系 — 视觉弱化 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-normal text-text-secondary w-14 flex-shrink-0">
            竞争关系
          </span>
          <WeakPill
            label={ALL}
            isSelected={isAllRelations}
            onClick={() => handleRelationClick(ALL)}
            disabled={isLoading}
          />
          {competitionRelationOptions.map((opt) => (
            <WeakPill
              key={opt}
              label={opt}
              isSelected={selectedRelations.includes(opt)}
              onClick={() => handleRelationClick(opt)}
              disabled={isLoading}
            />
          ))}
        </div>

        {/* Row 3: MDS 相关性 — 视觉弱化 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-normal text-text-secondary w-14 flex-shrink-0">
            MDS
          </span>
          <WeakPill
            label={ALL}
            isSelected={isAllMds}
            onClick={() => handleMdsClick(ALL)}
            disabled={isLoading}
          />
          {mdsRelatedOptions.map((opt) => (
            <WeakPill
              key={opt}
              label={opt}
              isSelected={selectedMds === opt}
              onClick={() => handleMdsClick(opt)}
              disabled={isLoading}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
