import React from "react";

export default function ProfilePage() {
  return (
    <div className="p-8 w-full">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Admin Profile</h1>

      {/* Profile Content Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
        <div className="flex items-center space-x-6 mb-8 border-b border-gray-100 pb-6">
          <div className="w-20 h-20 bg-blue-600 rounded-full overflow-hidden border-2 border-slate-200 shadow-sm">
            <img
              src="https://api.dicebear.com/7.x/initials/svg?seed=Joanne"
              alt="Joanne Paterno"
              className="w-full h-full object-cover bg-slate-200"
            />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">JOANNE PATERNO</h2>
            <p className="text-blue-600 text-sm font-semibold tracking-wider">
              ADMINISTRATOR
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Logistics & Fleet Operations
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <label className="block text-gray-400 font-medium mb-1">
              Full Name
            </label>
            <input
              type="text"
              readOnly
              value="Joanne Paterno"
              className="w-full bg-gray-50 text-gray-700 rounded-xl px-4 py-2.5 border border-gray-200 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-gray-400 font-medium mb-1">
              Email Address
            </label>
            <input
              type="email"
              readOnly
              value="joanne.admin@logisco.com"
              className="w-full bg-gray-50 text-gray-700 rounded-xl px-4 py-2.5 border border-gray-200 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-gray-400 font-medium mb-1">
              Role Permission
            </label>
            <input
              type="text"
              readOnly
              value="System Administrator"
              className="w-full bg-gray-50 text-gray-700 rounded-xl px-4 py-2.5 border border-gray-200 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-gray-400 font-medium mb-1">
              Other Information
            </label>
            <input
              type="text"
              readOnly
              value="-----"
              className="w-full bg-gray-50 text-gray-700 rounded-xl px-4 py-2.5 border border-gray-200 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
