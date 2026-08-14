// components/ActiveOffers.tsx
const OFFERS = [
  {
    code: 'STAY3NIGHTS',
    badge: 'Event',
    badgeColor: 'bg-amber-100 text-amber-700',
    title: 'Long Stay Bonus',
    desc: '$50 off stays of 3+ nights',
    sub: '50 off - min 300',
  },
  {
    code: 'VIP15',
    badge: 'Guest Type',
    badgeColor: 'bg-sky-100 text-sky-700',
    title: 'VIP Exclusive',
    desc: '15% off all returning guests',
    sub: '15% off - min 100',
  },
  {
    code: 'SUMMER25',
    badge: 'Seasonal',
    badgeColor: 'bg-sky-100 text-sky-700',
    title: 'Summer Getaway',
    desc: '25% off all summer stays',
    sub: '25% off - min 200',
  },
  {
    code: 'WELCOME10',
    badge: 'All Guests',
    badgeColor: 'bg-slate-100 text-slate-600',
    title: 'Welcome Offer',
    desc: '10% off your first booking',
    sub: '10% off',
  },
];

export default function ActiveOffers() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
        <svg className="w-4 h-4 fill-amber-500" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
        <span>Active Offers</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {OFFERS.map((item, index) => (
          <div key={index} className="bg-white border border-gray-100 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-blue-600 text-white text-[11px] font-bold px-2 py-0.5 rounded">
                {item.code}
              </span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                {item.badge}
              </span>
            </div>
            <h4 className="font-bold text-gray-800 text-sm">{item.title}</h4>
            <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
            <p className="text-[11px] text-blue-600 font-medium mt-2">{item.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}