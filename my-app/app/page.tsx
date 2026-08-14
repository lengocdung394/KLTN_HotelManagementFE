// app/page.tsx
import HeroBanner from '../components/HeroBanner';
import ActiveOffers from '../components/ActiveOffers';
import RoomFilter from '../components/RoomFilter'
import RoomCard from '../components/RoomCard';

export default function HomePage() {
  return (
    <div className="space-y-6">
      {/* 2. Banner chính */}
      <HeroBanner />

      {/* 3. Khối khuyến mãi (Active Offers) */}
      <ActiveOffers />

      {/* 4. Phần Nội dung chính (Filter + Danh sách phòng) */}
      <section className="space-y-4">
        {/* Bộ lọc và ô Tìm kiếm */}
        <RoomFilter />

        {/* Grid hiển thị danh sách phòng */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* Các phòng tiếp theo... */}
        </div>
      </section>
    </div>
  );
}