// components/Header.tsx
import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
            A
          </div>
          <span className="font-bold text-lg text-gray-800">Aurora</span>
        </div>

        {/* Navigation Menu */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
          <Link href="/" className="text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">Rooms</Link>
          <Link href="#" className="hover:text-blue-600">My Bookings</Link>
          <Link href="#" className="hover:text-blue-600">Services</Link>
          <Link href="#" className="hover:text-blue-600">Check-in</Link>
          <Link href="#" className="hover:text-blue-600">Profile</Link>
        </nav>

        {/* Action Button */}
        <div>
          <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg font-medium">
            Sign In
          </button>
        </div>
      </div>
    </header>
  );
}