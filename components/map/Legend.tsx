export default function Legend() {
  return (
    <div className="absolute bottom-4 right-4 z-[1000] bg-white rounded-lg shadow-md border border-border px-3 py-2 text-xs">
      <div className="font-semibold text-gray-700 mb-1.5">图例</div>
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: "#3B82F6" }} />
        <span className="text-gray-600">国内展会</span>
      </div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: "#F97316" }} />
        <span className="text-gray-600">国际展会</span>
      </div>
      <div className="border-t border-gray-100 pt-1.5 mt-1.5">
        <div className="text-gray-500 mb-0.5">圆圈大小 = 展会数量</div>
        <div className="flex items-end gap-1.5">
          <span className="inline-block rounded-full" style={{ width: 6, height: 6, backgroundColor: "#9CA3AF" }} />
          <span className="inline-block rounded-full" style={{ width: 14, height: 14, backgroundColor: "#9CA3AF" }} />
          <span className="inline-block rounded-full" style={{ width: 26, height: 26, backgroundColor: "#9CA3AF" }} />
        </div>
      </div>
    </div>
  );
}
