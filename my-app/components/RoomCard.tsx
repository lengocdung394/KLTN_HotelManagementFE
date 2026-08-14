// components/RoomCard.tsx
export interface RoomProps {
  roomName: string;
  floor: string;
  type: string;
  status: 'Occupied' | 'Available' | 'Reserved' | 'Cleaning' | 'Maintenance';
  guests: number;
  price: number;
  amenities: string[];
}

const STATUS_STYLES = {
  Available: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  Occupied: 'bg-sky-50 text-sky-600 border-sky-200',
  Reserved: 'bg-amber-50 text-amber-600 border-amber-200',
  Cleaning: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  Maintenance: 'bg-rose-50 text-rose-600 border-rose-200',
};

export default function RoomCard({
  roomName,
  floor,
  type,
  status,
  guests,
  price,
  amenities,
}: RoomProps) {
  const isAvailable = status === 'Available';

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h3 className="font-bold text-gray-900 text-base">{roomName}</h3>
            <span className="text-xs text-gray-400">{floor}</span>
          </div>
          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_STYLES[status]}`}>
            • {status}
          </span>
        </div>
        <p className="text-xs text-gray-500 font-medium mt-0.5">{type}</p>
      </div>

      {/* Info Row: Guests & Price */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span>{guests} guests</span>
        </div>
        <div>
          <span className="font-bold text-gray-900 text-base">${price}</span>
          <span className="text-xs text-gray-400 font-normal"> /night</span>
        </div>
      </div>

      {/* Amenities Icons */}
      <div className="flex items-center gap-3 text-[11px] text-gray-500 pt-1 border-t border-gray-50">
        {amenities.map((item, index) => (
          <span key={index} className="flex items-center gap-1">
            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
            {item}
          </span>
        ))}
      </div>

      {/* Button Action */}
      <button
        disabled={!isAvailable}
        className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all ${
          isAvailable
            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        {isAvailable ? 'Book This Room' : 'Unavailable'}
      </button>
    </div>
  );
}