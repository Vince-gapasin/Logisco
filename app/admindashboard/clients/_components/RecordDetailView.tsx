"use client";

import { useState } from "react";
import {
  Trash2,
  ArrowLeft,
  Edit3,
  AlertTriangle,
} from "lucide-react";
import type {
  ClientRecord,
  PartnerRecord,
  TabType,
  UnifiedRecord,
} from "./types";

// ==========================================
// RECORD DETAIL VIEW COMPONENT
// ==========================================

interface RecordDetailViewProps {
  record: UnifiedRecord;
  tabType: TabType;
  onBack: () => void;
  onEdit: (record: UnifiedRecord) => void;
  onDelete: (id: string | number) => void;
}

export function RecordDetailView({
  record,
  tabType,
  onBack,
  onEdit,
  onDelete,
}: RecordDetailViewProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const isClient = (rec: UnifiedRecord): rec is ClientRecord =>
    tabType === "Clients";
  const isPartner = (rec: UnifiedRecord): rec is PartnerRecord =>
    tabType === "Partners";

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-[100dvh] animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="min-w-tap min-h-tap md:pointer-fine:min-w-0 md:pointer-fine:min-h-0 inline-flex items-center justify-center p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs"
            title={`Back to ${tabType}`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {tabType.slice(0, -1)} Information Record
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Complete profile retrieved directly from database.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onEdit(record)}
            className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit Record</span>
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center text-2xl font-bold border border-blue-100">
              {record.name ? record.name[0].toUpperCase() : "R"}
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                {record.name}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  {tabType}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  {record.status || "Active"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 text-sm text-slate-900">
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              1. General Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Name / Company
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 truncate">
                  {record.name || "—"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Contact Person
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 truncate">
                  {record.contactPerson || "—"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Contact Number
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 truncate">
                  {record.contactNumber || "—"}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-black mb-1">
                  Email Address
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 truncate">
                  {record.emailAddress || "—"}
                </div>
              </div>
              {isPartner(record) && (
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Contract Type
                  </label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                    {record.contractType || "—"}
                  </div>
                </div>
              )}
              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-black mb-1">
                  Address
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-tap wrap-break-word">
                  {isPartner(record) || isClient(record)
                    ? record.businessAddress
                    : "N/A"}
                </div>
              </div>
            </div>
          </div>

          {isClient(record) && (
            <>
              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                  2. Pickup Addresses
                </div>
                {record.pickupAddresses && record.pickupAddresses.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left border-collapse text-xs table-fixed">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                          <th className="p-2.5 border-r border-slate-200 w-[25%]">
                            Warehouse Name
                          </th>
                          <th className="p-2.5 border-r border-slate-200 w-[35%]">
                            Address
                          </th>
                          <th className="p-2.5 border-r border-slate-200 w-[20%]">
                            Contact Person
                          </th>
                          <th className="p-2.5 w-[20%] text-center">
                            Contact Number
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {record.pickupAddresses.map((p, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-slate-200 last:border-0"
                          >
                            <td className="p-2.5 border-r border-slate-200 truncate">
                              {p.warehouseName || "—"}
                            </td>
                            <td className="p-2.5 border-r border-slate-200 truncate">
                              {p.warehouseAddress || "—"}
                            </td>
                            <td className="p-2.5 border-r border-slate-200 truncate">
                              {p.contactPerson || "—"}
                            </td>
                            <td className="p-2.5 truncate text-center">
                              {p.contactNumber || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 py-2">
                    No pickup addresses recorded.
                  </div>
                )}
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                  3. Delivery Addresses
                </div>
                {record.deliveryAddresses &&
                record.deliveryAddresses.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left border-collapse text-xs table-fixed">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                          <th className="p-2.5 border-r border-slate-200 w-[25%]">
                            Branch Name
                          </th>
                          <th className="p-2.5 border-r border-slate-200 w-[35%]">
                            Address
                          </th>
                          <th className="p-2.5 border-r border-slate-200 w-[20%]">
                            Contact Person
                          </th>
                          <th className="p-2.5 w-[20%] text-center">
                            Contact Number
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {record.deliveryAddresses.map((d, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-slate-200 last:border-0"
                          >
                            <td className="p-2.5 border-r border-slate-200 truncate">
                              {d.branchName || "—"}
                            </td>
                            <td className="p-2.5 border-r border-slate-200 truncate">
                              {d.deliveryAddress || "—"}
                            </td>
                            <td className="p-2.5 border-r border-slate-200 truncate">
                              {d.contactPerson || "—"}
                            </td>
                            <td className="p-2.5 truncate text-center">
                              {d.contactNumber || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 py-2">
                    No delivery addresses recorded.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 overflow-y-auto z-70 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center my-auto">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Delete Record
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete{" "}
              <strong className="text-slate-900">{record.name}</strong>? It can
              no longer be chosen for new bookings. Past bookings keep their
              record of it.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(record.id);
                  setShowDeleteModal(false);
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-md"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
