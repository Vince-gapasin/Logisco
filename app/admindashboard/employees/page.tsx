"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, UserPlus, FileText, Filter, ChevronDown } from "lucide-react";

export default function EmployeesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("All Roles");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const roles = [
    "All Roles",
    "Admin",
    "Coordinator",
    "Mechanic",
    "Driver",
    "Helper",
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Employee Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Manage your staff listings, employee profiles, and directory
            records.
          </p>
        </div>

        {/* Action Button: */}
        <div className="flex justify-center sm:justify-start w-full sm:w-auto">
          <button
            onClick={() =>
              alert(
                `Add new employee modal for role filter: ${selectedRole} will open here!`,
              )
            }
            className="w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md transition-colors duration-200 whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Main Content Container Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Section Heading & Toolbar Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            List of Employees
          </h2>

          {/* Search Bar & Filter Dropdown Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  selectedRole === "All Roles"
                    ? "Search employees..."
                    : `Search ${selectedRole.toLowerCase()}s...`
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Filter Dropdown Menu Container */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full sm:w-auto inline-flex items-center justify-between gap-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium rounded-xl px-4 py-2.5 text-sm transition-all duration-200"
              >
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>
                    Role:{" "}
                    <strong className="text-slate-900 font-semibold">
                      {selectedRole}
                    </strong>
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Dropdown Menu Items */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-full sm:w-48 bg-white border border-slate-100 rounded-xl shadow-lg z-20 py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {roles.map((role) => {
                    const isSelected = selectedRole === role;
                    return (
                      <button
                        key={role}
                        onClick={() => {
                          setSelectedRole(role);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${
                          isSelected
                            ? "bg-blue-50 text-blue-600 font-semibold"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span>{role}</span>
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 5-Column Data Table Structure with Horizontal Scrolling Protection */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-187.5">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6">Name</th>
                <th className="py-3.5 px-4 sm:px-6">Role</th>
                <th className="py-3.5 px-4 sm:px-6">Address</th>
                <th className="py-3.5 px-4 sm:px-6">Contact Number</th>
                <th className="py-3.5 px-4 sm:px-6">Health Status</th>
              </tr>
            </thead>
            <tbody>
              {/* Empty State Placeholder */}
              <tr>
                <td colSpan={5} className="py-16 sm:py-20 text-center">
                  <div className="flex flex-col items-center justify-center px-4">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
                      <FileText className="w-6 h-6" />
                    </div>
                    <p className="text-slate-900 font-medium text-sm">
                      No records found{" "}
                      {selectedRole !== "All Roles"
                        ? `for role "${selectedRole}"`
                        : ""}
                    </p>
                    <p className="text-slate-600 text-xs mt-1 max-w-sm">
                      Staff listings and employee profiles will appear here once
                      connected to your backend database.
                    </p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Pagination Footer Placeholder */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 bg-white">
          <span>Showing 0 of 0 entries</span>
          <div className="flex items-center gap-2">
            <button
              disabled
              className="px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed"
            >
              Previous
            </button>
            <button
              disabled
              className="px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
