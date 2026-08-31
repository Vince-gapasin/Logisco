import type { Employee } from "./employee.model";

export type CreateEmployeeDto = Pick<
  Employee,
  | "employeeID"
  | "employeeName"
  | "role"
  | "availability"
  | "healthStatus"
  | "address"
  | "contact"
> &
  Partial<
    Omit<
      Employee,
      | "employeeID"
      | "employeeName"
      | "role"
      | "availability"
      | "healthStatus"
      | "address"
      | "contact"
      | "emailAddress"
      | "auth_id"
    >
  > & {
    emailAddress: string;
  };


export type UpdateEmployeeDto = Partial<
  Omit<
    Employee,
    | "employeeID"
    | "auth_id"
    | "emailAddress"
  >
>;


export interface EmployeeQueryDto {
  page: number;
  limit: number;

  search?: string;

  role?: string;
  availability?: string;
  healthStatus?: string;
  isActive?: boolean;

  sortBy:
    | "employeeName"
    | "employeeCode"
    | "dateEmployed";

  sortOrder:
    | "asc"
    | "desc";
}