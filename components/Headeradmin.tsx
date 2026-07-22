import React from "react";
import Link from "next/link";
import { Search, Bell } from "lucide-react";

export default function Header() {
  return (
    <header className="h-16 bg-white shadow-sm flex justify-between items-center px-8 z-10 shrink-0">
      {/* Search Input Bar */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search..."
          className="w-full bg-gray-100/80 text-sm text-gray-700 rounded-full pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center space-x-6">
        {/* Clickable Notification Bell Link */}
        <Link
          href="/admindashboard/notifications"
          className="relative cursor-pointer hover:bg-gray-100 p-2 rounded-full transition flex items-center justify-center"
          title="Notifications"
        >
          <Bell className="w-6 h-6 text-gray-600" />

          {/* Optional unread notification dot */}
          {/*<span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>*/}
        </Link>

        {/* Clickable Profile Avatar Link */}
        <Link
          href="/admindashboard/profile"
          className="w-10 h-10 bg-blue-600 rounded-full overflow-hidden border-2 border-white shadow-sm cursor-pointer hover:opacity-90 transition block"
          title="Profile Settings"
        >
          <img
            src="https://api.dicebear.com/7.x/initials/svg?seed=Joanne"
            alt="Avatar"
            className="w-full h-full object-cover bg-slate-200"
          />
        </Link>
      </div>
    </header>
  );
}
