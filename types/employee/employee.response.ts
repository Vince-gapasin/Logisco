import type { Employee } from "./employee.model";

export interface EmployeeResponse {
  message?: string;
  data: Employee;
}

export interface EmployeesResponse {
  data: Employee[];

  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}