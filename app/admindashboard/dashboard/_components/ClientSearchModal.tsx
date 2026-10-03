"use client";

import { useState } from "react";
import type { ClientRow } from "@/types/database";
import { X, Search } from "lucide-react";

// ==========================================
// CLIENT SEARCH MODAL
// ==========================================

interface ClientSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Partial<ClientRow>[];
  onSelectClient: (clientID: string) => void;
  onOpenNewClientBooking: () => void;
}

export function ClientSearchModal({
  isOpen,
  onClose,
  clients,
  onSelectClient,
  onOpenNewClientBooking,
}: ClientSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  if (!isOpen) return null;

  const filteredClients = searchTerm.trim()
    ? clients.filter((client) =>
        (client.company ?? "").toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : clients;

  const handleClose = () => {
    setSearchTerm("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg relative p-6 sm:p-10 flex flex-col items-center text-center max-h-[90dvh]">
        <button
          onClick={handleClose}
          className="min-w-tap min-h-tap md:min-w-0 md:min-h-0 inline-flex items-center justify-center absolute top-4 right-4 p-1.5 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6 tracking-tight shrink-0">
          Select Registered Client
        </h2>
        <div className="relative w-full max-w-md mb-5 shrink-0">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search client name..."
            className="w-full bg-white border border-slate-300 rounded-full pl-4 pr-10 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
          />
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        </div>

        {filteredClients.length > 0 && (
          <div className="w-full max-w-md mb-6 animate-fade-in overflow-hidden flex flex-col">
            <div className="text-left font-bold text-slate-800 text-xs mb-1.5 ml-1 shrink-0">
              {searchTerm.trim() ? "Results" : "All Registered Clients"}
            </div>
            <div className="border border-slate-300 rounded-lg shadow-sm overflow-y-auto max-h-[40dvh] feed-scrollbar">
              <table className="w-full text-left border-collapse bg-white relative">
                <tbody className="divide-y divide-slate-200">
                  {filteredClients.map((client, index) => (
                    <tr
                      key={client.clientID}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="w-10 text-center py-2 border-r border-slate-200 text-slate-800 text-sm font-medium">
                        {index + 1}
                      </td>
                      <td className="px-3 py-2 text-slate-800 text-sm">
                        {client.company}
                      </td>
                      <td className="w-20 text-center border-l border-slate-200">
                        <button
                          onClick={() => onSelectClient(client.clientID ?? "")}
                          className="min-h-tap md:min-h-0 inline-flex items-center justify-center text-blue-500 hover:text-blue-700 text-sm font-medium px-2 py-1"
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <button
          onClick={() => {
            handleClose();
            onOpenNewClientBooking();
          }}
          className="mt-2 bg-blue-600 hover:bg-black px-6 py-2.5 text-white font-bold rounded-lg text-sm shadow-md transition-colors duration-200 w-full sm:w-auto shrink-0"
        >
          Create Booking for New Client
        </button>
      </div>
    </div>
  );
}
