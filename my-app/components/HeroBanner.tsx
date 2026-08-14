// components/HeroBanner.tsx
export default function HeroBanner() {
  return (
    <div className="bg-blue-600 text-white rounded-2xl p-8 shadow-md">
      {/* Badge nhỏ ở trên */}
      <div className="inline-flex items-center gap-2 bg-blue-500/40 text-white text-xs font-semibold px-3 py-1 rounded-md mb-4 border border-blue-400/30">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1" />
        </svg>
        <span>Available Rooms</span>
      </div>

      {/* Tiêu đề & Nội dung */}
      <h1 className="text-3xl font-extrabold tracking-tight mb-2">
        Find your perfect stay
      </h1>
      <p className="text-blue-100 text-sm max-w-2xl leading-relaxed">
        Browse our room collection and book instantly. All rooms include complimentary Wi-Fi and premium amenities.
      </p>
    </div>
  );
}