/* eslint-disable react-hooks/set-state-in-effect */
// ==========================================
// CLIENTS & PARTNERS MANAGEMENT PAGE
// ==========================================
"use client";

import UrlSearchSync from "@/components/UrlSearchSync";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/app/lib/apiClient";
import { useToast } from "@/components/Toast";
import { UserPlus, Search } from "lucide-react";
import type {
  ClientRecord,
  ClientsResponse,
  PartnerRecord,
  PartnersResponse,
  TabType,
  UnifiedRecord,
} from "./_components/types";
import { RecordDetailView } from "./_components/RecordDetailView";
import { ClientModal } from "./_components/ClientModal";
import { PartnerModal } from "./_components/PartnerModal";
import { ClientsTable } from "./_components/ClientsTable";


// ==========================================
// MAIN CLIENTS PAGE COMPONENT
// ==========================================

export default function ClientsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("Clients");
  const [searchTerm, setSearchTerm] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<UnifiedRecord | null>(
    null,
  );
  const [editingRecord, setEditingRecord] = useState<UnifiedRecord | null>(
    null,
  );


  const showToast = useToast();
  const [dataMap, setDataMap] = useState<Record<TabType, UnifiedRecord[]>>({
    Clients: [],
    Partners: [],
  });


  const fetchClientsAndPartners = useCallback(async () => {
    try {
      const clientRes = await apiFetch<ClientsResponse>("/api/clients");
      const mappedClients: ClientRecord[] = clientRes.data
        .filter((c) => c.contractType !== "On-Call")
        .map((c) => ({
          id: c.clientID ?? "",
          name: c.company ?? "",
          status: c.status ?? "",
          contactPerson: c.contactName ?? "",
          contactNumber: c.contact ?? "",
          emailAddress: c.emailAdd ?? "",
          businessAddress: c.businessAdd ?? "",
          pickupAddresses: (c.Warehouse ?? []).map((w) => ({
            warehouseID: w.warehouseID ?? "",
            warehouseName: w.whName || "",
            warehouseAddress: w.warehouseLoc || "",
            contactPerson: w.contactPerson || "",
            contactNumber: w.contactNum || "",
          })),
          deliveryAddresses: (c.Branch ?? []).map((b) => ({
            branchID: b.branchID ?? "",
            branchName: b.branchName || "",
            deliveryAddress: b.deliveryAddress || "",
            contactPerson: b.contactPerson || "",
            contactNumber: b.contactNumber || "",
          })),
        }));

      // SECURE FIX: Now pulls securely from our new Next.js Subcontractors route!
      const partnerRes = await apiFetch<PartnersResponse>(
        "/api/subcontractors",
      );
      const mappedPartners: PartnerRecord[] = partnerRes.data.map((p) => ({
        id: p.subConID ?? "",
        name: p.companyName ?? "",
        status: p.isActive !== false ? "Active" : "Inactive",
        contractType: p.contractType || "On-Call",
        contactPerson: p.contactName ?? "",
        contactNumber: p.contactNumber ?? "",
        emailAddress: p.emailAddress || "",
        businessAddress: p.businessAddress || "",
      }));

      setDataMap({
        Clients: mappedClients,
        Partners: mappedPartners,
      });
    } catch (error) {
      console.error("Failed to fetch data from Database:", error);
      showToast("Failed to load records", "error");
    }
    // showToast is memoised all the way up through the provider, so naming it
    // here satisfies the rule without making this callback churn.
  }, [showToast]);

  useEffect(() => {
    fetchClientsAndPartners();
  }, [fetchClientsAndPartners]);

  const currentData = dataMap[activeTab].filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const checkNoChanges = (original: UnifiedRecord, updated: UnifiedRecord) => {
    return JSON.stringify(original) === JSON.stringify(updated);
  };

  const handleClientSubmit = async (newRecord: ClientRecord) => {
    try {
      if (editingRecord) {
        if (checkNoChanges(editingRecord, newRecord)) {
          showToast("No changes were made.", "info");
          setEditingRecord(null);
          return;
        }

        const payload = {
          name: newRecord.name,
          contactName: newRecord.contactPerson,
          contactNumber: newRecord.contactNumber,
          emailAddress: newRecord.emailAddress,
          businessAddress: newRecord.businessAddress,
          // Sent so they are saved; the edit used to drop them.
          pickupAddresses: newRecord.pickupAddresses ?? [],
          deliveryAddresses: newRecord.deliveryAddresses ?? [],
        };

        await apiFetch(`/api/clients/${newRecord.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });

        showToast("Changes saved successfully.", "success");
      } else {
        const payload = {
          name: newRecord.name,
          contactName: newRecord.contactPerson,
          contactNumber: newRecord.contactNumber,
          emailAddress: newRecord.emailAddress,
          businessAddress: newRecord.businessAddress,
          pickupAddresses: newRecord.pickupAddresses,
          deliveryAddresses: newRecord.deliveryAddresses,
        };

        await apiFetch(`/api/clients`, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        showToast("Added successfully.", "success");
      }

      setEditingRecord(null);
      await fetchClientsAndPartners();
      if (editingRecord) setSelectedRecord(newRecord);
    } catch (error) {
      console.error("Failed to save client to Database:", error);
      showToast(error instanceof Error ? error.message : "Error saving record.", "error");
    }
  };

  const handlePartnerSubmit = async (newRecord: PartnerRecord) => {
    try {
      // Structure explicitly formatted to match what POST /api/subcontractors expects
      const payload = {
        companyName: newRecord.name,
        contractType: newRecord.contractType,
        contactPerson: newRecord.contactPerson,
        contactNumber: newRecord.contactNumber,
        emailAddress: newRecord.emailAddress,
        businessAddress: newRecord.businessAddress,
      };

      if (editingRecord) {
        if (checkNoChanges(editingRecord, newRecord)) {
          showToast("No changes were made.", "info");
          setEditingRecord(null);
          return;
        }

        await apiFetch(`/api/subcontractors/${newRecord.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        showToast("Changes saved successfully.", "success");
      } else {
        await apiFetch(`/api/subcontractors`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showToast("Added successfully.", "success");
      }

      setEditingRecord(null);
      await fetchClientsAndPartners();
      if (editingRecord) setSelectedRecord(newRecord);
    } catch (error) {
      console.error("Failed to save partner to Database:", error);
      showToast(error instanceof Error ? error.message : "Error saving record.", "error");
    }
  };

  const handleDeleteRecord = async (id: string | number) => {
    try {
      const endpoint = activeTab === "Partners" ? "subcontractors" : "clients";
      await apiFetch(`/api/${endpoint}/${id}`, { method: "DELETE" });

      setSelectedRecord(null);
      showToast("Deleted successfully.", "success");
      await fetchClientsAndPartners();
    } catch (error) {
      console.error(`Failed to delete ${activeTab} from Database:`, error);
      showToast(error instanceof Error ? error.message : "Error deleting record.", "error");
    }
  };

  if (selectedRecord) {
    return (
      <>
        <RecordDetailView
          record={selectedRecord}
          tabType={activeTab}
          onBack={() => setSelectedRecord(null)}
          onEdit={(rec) => {
            setEditingRecord(rec);
            setIsModalOpen(true);
          }}
          onDelete={handleDeleteRecord}
        />

        {activeTab === "Clients" && (
          <ClientModal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setEditingRecord(null);
            }}
            onSubmitSuccess={handleClientSubmit}
            editData={editingRecord as ClientRecord}
          />
        )}
        {activeTab === "Partners" && (
          <PartnerModal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setEditingRecord(null);
            }}
            onSubmitSuccess={handlePartnerSubmit}
            editData={editingRecord as PartnerRecord}
          />
        )}

        {/* TOAST NOTIFICATION */}
      </>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-[100dvh] relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Clients & Partners
          </h1>
          </div>

        <div className="flex justify-center sm:justify-start w-full sm:w-auto">
          {activeTab === "Clients" && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md transition-colors duration-200 whitespace-nowrap cursor-pointer"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              <span>Add Client</span>
            </button>
          )}
          {activeTab === "Partners" && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md transition-colors duration-200 whitespace-nowrap cursor-pointer"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              <span>Add Partner</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="border-b border-slate-100 px-4 sm:px-6 pt-4 flex gap-6 sm:gap-8 overflow-x-auto">
          {(["Clients", "Partners"] as TabType[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSearchTerm("");
                }}
                style={
                  isActive ? { color: "oklch(54.6% 0.245 262.881)" } : undefined
                }
                className={`pb-4 text-sm sm:text-base transition-all relative whitespace-nowrap ${
                  isActive
                    ? "font-semibold"
                    : "text-slate-600 hover:text-slate-900 font-normal"
                }`}
              >
                {tab}
                {isActive && (
                  <div
                    style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }}
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-4 bg-white">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <UrlSearchSync onQuery={setSearchTerm} />
            <input
              type="text"
              placeholder={`Search ${activeTab.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-sm font-normal text-slate-900 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-500"
            />
          </div>
        </div>

        <ClientsTable
          activeTab={activeTab}
          currentData={currentData}
          onRowClick={(record) => setSelectedRecord(record)}
        />
      </div>

      {activeTab === "Clients" && (
        <ClientModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmitSuccess={handleClientSubmit}
        />
      )}
      {activeTab === "Partners" && (
        <PartnerModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmitSuccess={handlePartnerSubmit}
        />
      )}

    </div>
  );
}
