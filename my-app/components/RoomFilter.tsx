// components/RoomFilter.tsx
'use client';
import { useState } from 'react';

const CATEGORIES = ['All', 'Standard', 'Deluxe', 'Suite', 'Presidential'];

export default function RoomFilter() {
  const [activeTab, setActiveTab] = useState('All');

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-2">
      {/* Category Tabs */}
      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
        {CATEGORIES.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Search Input */}
      <div className="relative w-full md:w-64">
        <svg
          className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search room number..."
          className="w-full pl-9 pr-4 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-gray-700"
        />
      </div>
    </div>
  );
}