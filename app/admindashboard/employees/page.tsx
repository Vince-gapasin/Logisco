/* eslint-disable react-hooks/set-state-in-effect */
// EMPLOYEE_LOGIN_ACCESS_V1
// EMPLOYEE_COORDINATOR_READ_ONLY_V1
// EMPLOYEE_AUTOMATIC_AVAILABILITY_V5
// ==========================================
// LOGISCO - EMPLOYEE DIRECTORY
// ==========================================

"use client";

import RowOpenButton from "@/components/RowOpenButton";
import UrlSearchSync from "@/components/UrlSearchSync";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { apiFetch } from "@/app/lib/apiClient";
import { AVAILABILITY, MANUAL_AVAILABILITY } from "@/app/lib/enums";
import {
  Search,
  UserPlus,
  Trophy,
  FileText,
  Filter,
  ChevronDown,
  Loader2,
} from "lucide-react";
import type {
  EmployeeApiResponse,
  EmployeeFormState,
  EmployeeRecord,
  EmployeesApiResponse,
  MessageResponse,
  UserSession,
} from "./_components/types";
import { getAuthSession, getErrorMessage, mapApiEmployee } from "./_components/helpers";
import { EmployeeDetailView } from "./_components/EmployeeDetailView";
import { RankingsView } from "./_components/RankingsView";
import { EmployeeModal } from "./_components/EmployeeModal";


// ==========================================
// CONFIG
// ==========================================

const ITEMS_PER_PAGE = 10;

// ==========================================
// MAIN PAGE
// ==========================================

export default function EmployeesPage() {
  const [currentSession, setCurrentSession] = useState<UserSession | null>(
    null,
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("All Roles");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [selectedEmployee, setSelectedEmployee] =
    useState<EmployeeRecord | null>(null);
  // The rankings view, in place of the directory.
  const [showRankings, setShowRankings] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRecord | null>(
    null,
  );

  const [employeeList, setEmployeeList] = useState<EmployeeRecord[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEmployees, setTotalEmployees] = useState(0);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const roles = [
    "All Roles",
    "Admin",
    "Coordinator",
    "Mechanic",
    "Driver",
    "Helper",
  ];

  // ==========================================
  // SESSION
  // ==========================================

  useEffect(() => {
    try {
      setCurrentSession(getAuthSession());
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }, []);

  // Toast clearing logic
  useEffect(() => {
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage("");
        setErrorMessage("");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, errorMessage]);

  // ==========================================
  // FETCH EMPLOYEES
  // ==========================================

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("limit", String(ITEMS_PER_PAGE));
      params.set("sortBy", "employeeName");
      params.set("sortOrder", "asc");

      if (debouncedSearchTerm) {
        params.set("search", debouncedSearchTerm);
      }
      if (selectedRole !== "All Roles") {
        params.set("role", selectedRole);
      }

      const response = await apiFetch<EmployeesApiResponse>(
        `/api/employees?${params.toString()}`,
      );

      setEmployeeList(response.data.map(mapApiEmployee));
      setTotalEmployees(response.pagination.total);
      setTotalPages(Math.max(response.pagination.totalPages, 1));
    } catch (error) {
      console.error("Fetch employees error:", error);
      setEmployeeList([]);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, debouncedSearchTerm, selectedRole]);

  useEffect(() => {
    void fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCurrentPage(1);
      setDebouncedSearchTerm(searchTerm.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  // ==========================================
  // GET ONE
  // ==========================================

  const handleRowClick = async (id: string) => {
    try {
      setErrorMessage("");
      const response = await apiFetch<EmployeeApiResponse>(
        `/api/employees/${id}`,
      );
      setSelectedEmployee(mapApiEmployee(response.data));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  // Refresh an open profile once per minute so the three-hour Booked window
  // and live dispatch status can change without reopening the employee.
  useEffect(() => {
    const employeeID = selectedEmployee?.id;
    if (!employeeID) return;

    const refreshAvailability = async () => {
      try {
        const response = await apiFetch<EmployeeApiResponse>(
          `/api/employees/${employeeID}`,
        );
        setSelectedEmployee(mapApiEmployee(response.data));
      } catch (error) {
        console.error("Refresh employee availability error:", error);
      }
    };

    const interval = window.setInterval(() => {
      void refreshAvailability();
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [selectedEmployee?.id]);

  // ==========================================
  // CREATE / UPDATE
  // ==========================================

  const handleModalSubmit = async (
    formData: EmployeeFormState,
    editData?: EmployeeRecord | null,
  ) => {
    try {
      setErrorMessage("");
      setSuccessMessage("");

      if (editData) {
        const updatePayload = {
          employeeName: `${formData.firstName} ${formData.lastName}`.trim(),
          middleName: formData.middleName || null,
          suffix: formData.suffix || null,
          role: formData.role,
          gender: formData.gender || null,
          birthdate: formData.birthdate || null,
          address: formData.address,
          contact: formData.contactNumber,
          bloodType: formData.bloodType || null,
          nationality: formData.nationality || null,
          religion: formData.religion || null,
          dateEmployed: formData.dateEmployed || null,
          driverLicenseType: formData.driverLicenseType || null,
          licenseNumber: formData.licenseNumber || null,
          licenseExpirationDate: formData.licenseExpirationDate || null,
          drivingExperience: formData.drivingExperience
            ? Number(formData.drivingExperience)
            : null,
          healthStatus: formData.healthCondition,
          drugTestStatus: formData.drugTestStatus || null,
          lastMedicalCheckup: formData.lastMedicalCheckup || null,
          emergencyContactPerson: formData.emergencyContactPerson || null,
          emergencyContactNumber: formData.emergencyContactNumber || null,
          relationship: formData.relationship || null,
          skills: formData.skills || null,
          remarks: formData.remarks || null,
          // Only what an admin set; a trip state is never sent back.
          availability: MANUAL_AVAILABILITY.includes(
            formData.availability as (typeof MANUAL_AVAILABILITY)[number],
          )
            ? formData.availability
            : AVAILABILITY.available,
        };

        const hasChanges =
          updatePayload.availability !==
            (MANUAL_AVAILABILITY.includes(editData.availability as (typeof MANUAL_AVAILABILITY)[number])
              ? editData.availability
              : AVAILABILITY.available) ||
          updatePayload.employeeName !==
            `${editData.firstName} ${editData.lastName}`.trim() ||
          updatePayload.middleName !== (editData.middleName || null) ||
          updatePayload.suffix !== (editData.suffix || null) ||
          updatePayload.role !== editData.role ||
          updatePayload.gender !== (editData.gender || null) ||
          updatePayload.birthdate !==
            (editData.birthdate ? editData.birthdate.split("T")[0] : null) ||
          updatePayload.address !== editData.address ||
          updatePayload.contact !== editData.contactNumber ||
          updatePayload.bloodType !== (editData.bloodType || null) ||
          updatePayload.nationality !== (editData.nationality || null) ||
          updatePayload.religion !== (editData.religion || null) ||
          updatePayload.dateEmployed !==
            (editData.dateEmployed
              ? editData.dateEmployed.split("T")[0]
              : null) ||
          updatePayload.driverLicenseType !==
            (editData.driverLicenseType || null) ||
          updatePayload.licenseNumber !== (editData.licenseNumber || null) ||
          updatePayload.licenseExpirationDate !==
            (editData.licenseExpirationDate
              ? editData.licenseExpirationDate.split("T")[0]
              : null) ||
          updatePayload.drivingExperience !==
            (editData.drivingExperience
              ? Number(editData.drivingExperience)
              : null) ||
          updatePayload.healthStatus !== editData.healthCondition ||
          updatePayload.drugTestStatus !== (editData.drugTestStatus || null) ||
          updatePayload.lastMedicalCheckup !==
            (editData.lastMedicalCheckup
              ? editData.lastMedicalCheckup.split("T")[0]
              : null) ||
          updatePayload.emergencyContactPerson !==
            (editData.emergencyContactPerson || null) ||
          updatePayload.emergencyContactNumber !==
            (editData.emergencyContactNumber || null) ||
          updatePayload.relationship !== (editData.relationship || null) ||
          updatePayload.skills !== (editData.skills || null) ||
          updatePayload.remarks !== (editData.remarks || null) ||
          Boolean(formData.certificates);

        if (!hasChanges) {
          setErrorMessage("No changes were made.");
          setIsModalOpen(false);
          setEditingEmployee(null);
          return;
        }

        await apiFetch<EmployeeApiResponse>(`/api/employees/${editData.id}`, {
          method: "PATCH",
          body: JSON.stringify(updatePayload),
        });

        if (selectedEmployee) {
          await handleRowClick(editData.id);
        }

        setSuccessMessage("Employee updated successfully.");
        setEditingEmployee(null);
      } else {
        const createPayload = {
          employeeID: crypto.randomUUID(),
          employeeName: `${formData.firstName} ${formData.lastName}`.trim(),
          middleName: formData.middleName || null,
          suffix: formData.suffix || null,
          role: formData.role,
          availability: "Available",
          healthStatus: formData.healthCondition,
          address: formData.address,
          contact: formData.contactNumber,
          emailAddress: formData.emailAddress,
          isActive: true,
          gender: formData.gender || null,
          birthdate: formData.birthdate || null,
          bloodType: formData.bloodType || null,
          nationality: formData.nationality || null,
          religion: formData.religion || null,
          dateEmployed: formData.dateEmployed || null,
          driverLicenseType: formData.driverLicenseType || null,
          licenseNumber: formData.licenseNumber || null,
          licenseExpirationDate: formData.licenseExpirationDate || null,
          drivingExperience: formData.drivingExperience
            ? Number(formData.drivingExperience)
            : null,
          drugTestStatus: formData.drugTestStatus || null,
          lastMedicalCheckup: formData.lastMedicalCheckup || null,
          emergencyContactPerson: formData.emergencyContactPerson || null,
          emergencyContactNumber: formData.emergencyContactNumber || null,
          relationship: formData.relationship || null,
          skills: formData.skills || null,
          remarks: formData.remarks || null,
        };

        await apiFetch<EmployeeApiResponse>("/api/employees", {
          method: "POST",
          body: JSON.stringify(createPayload),
        });

        setSuccessMessage(
          "Employee created successfully. You can activate the login account from the employee profile.",
        );
      }

      setIsModalOpen(false);
      await fetchEmployees();
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorMessage(message);
      throw error;
    }
  };

  // ==========================================
  // ACTIVATE ACCOUNT
  // ==========================================

  const handleActivateEmployee = async (id: string) => {
    try {
      setErrorMessage("");
      setSuccessMessage("");
      const response = await apiFetch<MessageResponse>(
        `/api/employees/${id}/activate`,
        {
          method: "POST",
        },
      );
      setSuccessMessage(
        response.message || "Activation email sent successfully.",
      );
      await handleRowClick(id);
      await fetchEmployees();
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorMessage(message);
      throw error;
    }
  };

  // ==========================================
  // ENABLE / DISABLE EMPLOYEE
  // ==========================================

  const handleToggleEmployeeStatus = async (employee: EmployeeRecord) => {
    try {
      setErrorMessage("");
      setSuccessMessage("");

      await apiFetch<EmployeeApiResponse>(`/api/employees/${employee.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !employee.isActive }),
      });

      setSuccessMessage(
        employee.isActive
          ? "Employee disabled successfully."
          : "Employee enabled successfully.",
      );

      await handleRowClick(employee.id);
      await fetchEmployees();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      throw error;
    }
  };

  // ==========================================
  // DELETE (Exactly matched to your updated code logic)
  // ==========================================

  const handleDeleteEmployee = async (id: string) => {
    try {
      await apiFetch<MessageResponse>(`/api/employees/${id}`, {
        method: "DELETE",
      });

      setSelectedEmployee(null);

      setSuccessMessage("Employee deleted successfully.");

      await fetchEmployees();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));

      throw error;
    }
  };

  // ==========================================
  // DROPDOWN OUTSIDE CLICK
  // ==========================================

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

  // ==========================================
  // RENDER HELPERS
  // ==========================================

  const renderToasts = () => {
    if (!successMessage && !errorMessage) return null;
    return (
      <div className="fixed bottom-[calc(1.5rem+var(--safe-bottom))] left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-100 animate-in fade-in slide-in-from-bottom-5">
        <div className="bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium border border-slate-700">
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
              errorMessage ? "bg-red-500" : "bg-emerald-500"
            }`}
          >
            {errorMessage ? (
              <svg
                className="w-3.5 h-3.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="w-3.5 h-3.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>
          {errorMessage || successMessage}
        </div>
      </div>
    );
  };

  // ==========================================
  // DETAIL
  // ==========================================

  if (selectedEmployee) {
    return (
      <>
        {renderToasts()}
        <EmployeeDetailView
          employee={selectedEmployee}
          currentRole={currentSession?.role || ""}
          onBack={() => setSelectedEmployee(null)}
          onEdit={(employee) => {
            setEditingEmployee(employee);
            setIsModalOpen(true);
          }}
          onDelete={handleDeleteEmployee}
          onActivate={handleActivateEmployee}
          onToggleStatus={handleToggleEmployeeStatus}
        />
        <EmployeeModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingEmployee(null);
          }}
          onSubmitSuccess={handleModalSubmit}
          editData={editingEmployee}
        />
      </>
    );
  }

  // ==========================================
  // PAGINATION SETUP
  // ==========================================

  const startIndex =
    totalEmployees === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, totalEmployees);
  const currentRole = currentSession?.role?.toLowerCase() || "";
  const canCreate = currentRole === "admin";

  // ==========================================
  // DIRECTORY
  // ==========================================

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-[100dvh] relative">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {showRankings ? "Performance Rankings" : "Employee Directory"}
          </h1>
          </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {/* Every role's ranking, beside the directory it is drawn from. */}
          <button
            type="button"
            onClick={() => setShowRankings((shown) => !shown)}
            className="w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl shadow-sm transition-colors duration-200 border border-slate-300 whitespace-nowrap cursor-pointer"
          >
            <Trophy className="w-4 h-4 shrink-0" />
            <span>{showRankings ? "Directory" : "Rankings"}</span>
          </button>

        {canCreate && !showRankings && (
          <div className="flex justify-center sm:justify-start w-full sm:w-auto">
            <button
              onClick={() => {
                setEditingEmployee(null);
                setIsModalOpen(true);
              }}
              className="w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md transition-colors duration-200 whitespace-nowrap cursor-pointer"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              <span>Add Employee</span>
            </button>
          </div>
        )}
        </div>
      </div>

      {showRankings ? (
        <RankingsView onOpen={(id) => void handleRowClick(id)} />
      ) : (

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* FILTERS */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            List of Employees
          </h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <UrlSearchSync onQuery={setSearchTerm} />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={
                  selectedRole === "All Roles"
                    ? "Search employees..."
                    : `Search ${selectedRole.toLowerCase()}s...`
                }
                className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-500"
              />
            </div>

            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full sm:w-auto inline-flex items-center justify-between gap-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium rounded-xl px-4 py-2.5 text-sm transition-all duration-200 cursor-pointer"
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

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-full sm:w-48 bg-white border border-slate-100 rounded-xl shadow-lg z-20 py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {roles.map((role) => {
                    const isSelected = selectedRole === role;
                    return (
                      <button
                        type="button"
                        key={role}
                        onClick={() => {
                          setCurrentPage(1);
                          setSelectedRole(role);
                          setIsDropdownOpen(false);
                        }}
                        className={`min-h-tap md:min-h-0 w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between cursor-pointer ${
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

        {/* TABLE */}
        <div className="overflow-x-auto min-h-135">
          <table className="w-full text-left border-collapse md:min-w-200 table-fixed">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6 w-[45%] md:w-[25%]">Name</th>
                <th className="py-3.5 px-4 sm:px-6 w-[25%] md:w-[15%]">Role</th>
                <th className="hidden md:table-cell py-3.5 px-4 sm:px-6 w-[20%]">Address</th>
                <th className="hidden md:table-cell py-3.5 px-4 sm:px-6 w-[20%]">Contact</th>
                <th className="py-3.5 px-4 sm:px-6 w-[30%] md:w-[20%]">Account</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-16 sm:py-20 text-center">
                    <div className="flex flex-col items-center justify-center px-4">
                      <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
                      <p className="text-slate-900 font-medium text-sm">
                        Loading records...
                      </p>
                      <p className="text-slate-600 text-xs mt-1">
                        Please wait while we fetch the employee directory.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : employeeList.length > 0 ? (
                employeeList.map((employee) => (
                  <tr
                    data-pressable
                    key={employee.id}
                    onClick={() => handleRowClick(employee.id)}
                    className="border-b border-slate-100 hover:bg-slate-50/80 cursor-pointer transition-colors text-sm text-slate-800"
                  >
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900 truncate">
                      <RowOpenButton
                        label={`View record for ${employee.firstName} ${employee.lastName}`}
                        onOpen={() => handleRowClick(employee.id)}
                        className="truncate max-w-full"
                      >
                        {employee.firstName}{" "}
                        {employee.middleName ? `${employee.middleName[0]}. ` : ""}
                        {employee.lastName} {employee.suffix}
                      </RowOpenButton>
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 truncate">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 whitespace-nowrap">
                        {employee.role}
                      </span>
                    </td>
                    <td
                      className="hidden md:table-cell py-3.5 px-4 sm:px-6 truncate"
                      title={employee.address}
                    >
                      {employee.address || "N/A"}
                    </td>
                    <td
                      className="hidden md:table-cell py-3.5 px-4 sm:px-6 truncate"
                      title={employee.contactNumber}
                    >
                      {employee.contactNumber || "N/A"}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 truncate">
                      {employee.activation_completed_at ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 whitespace-nowrap">
                          Login Access ✓
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 whitespace-nowrap">
                          No Access
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
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
                        Staff listings and employee profiles will appear here
                        once connected to your backend database or added via the
                        form.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 bg-white">
          <span>
            Showing {startIndex} to {endIndex} of {totalEmployees} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setCurrentPage((previous) => Math.max(previous - 1, 1))
              }
              disabled={currentPage <= 1 || isLoading}
              className={`min-h-tap md:min-h-0 px-4 py-1.5 inline-flex items-center justify-center border border-slate-200 rounded-lg font-medium transition-colors ${
                currentPage <= 1 || isLoading
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                  : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              }`}
            >
              Previous
            </button>
            <span className="mx-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage((previous) => Math.min(previous + 1, totalPages))
              }
              disabled={currentPage >= totalPages || isLoading}
              className={`min-h-tap md:min-h-0 px-4 py-1.5 inline-flex items-center justify-center border border-slate-200 rounded-lg font-medium transition-colors ${
                currentPage >= totalPages || isLoading
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                  : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>
      )}

      <EmployeeModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEmployee(null);
        }}
        onSubmitSuccess={handleModalSubmit}
        editData={editingEmployee}
      />

      {renderToasts()}
    </div>
  );
}
