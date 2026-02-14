"use client";

interface ProgressIndicatorProps {
  /** 0-100 for determinate, -1 for indeterminate */
  progress: number;
  label: string;
}

export default function ProgressIndicator({
  progress,
  label,
}: ProgressIndicatorProps) {
  const isIndeterminate = progress < 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-300">{label}</span>
        {!isIndeterminate && (
          <span className="text-gray-500">{Math.round(progress)}%</span>
        )}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
        {isIndeterminate ? (
          <div className="h-full w-1/3 animate-[indeterminate_1.5s_ease-in-out_infinite] rounded-full bg-blue-500" />
        ) : (
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        )}
      </div>
    </div>
  );
}
