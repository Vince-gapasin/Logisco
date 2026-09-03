import { supabase } from "@/app/lib/supabase";

import type {
  Employee,
  CreateEmployeeDto,
  UpdateEmployeeDto,
  EmployeeQueryDto,
} from "@/types/employee";

const TABLE = "Employee";


// ==========================================
// GET ALL + PAGINATION + SEARCH + FILTER + SORT
// ==========================================

export async function getEmployees(
  query: EmployeeQueryDto
) {
  const {
    page,
    limit,
    search,
    role,
    availability,
    healthStatus,
    isActive,
    sortBy,
    sortOrder,
  } = query;

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let dbQuery = supabase
    .from(TABLE)
    .select("*", {
      count: "exact",
    });

  // SEARCH
  if (search) {
    dbQuery = dbQuery.ilike(
      "employeeName",
      `%${search}%`
    );
  }

  // FILTERS
  if (role) {
    dbQuery = dbQuery.eq(
      "role",
      role
    );
  }

  if (availability) {
    dbQuery = dbQuery.eq(
      "availability",
      availability
    );
  }

  if (healthStatus) {
    dbQuery = dbQuery.eq(
      "healthStatus",
      healthStatus
    );
  }

  if (isActive !== undefined) {
    dbQuery = dbQuery.eq(
      "isActive",
      isActive
    );
  }

  // SORT + PAGINATION
  const {
    data,
    error,
    count,
  } = await dbQuery
    .order(sortBy, {
      ascending:
        sortOrder === "asc",
    })
    .range(from, to);

  if (error) {
    throw error;
  }

  return {
    employees:
      data as Employee[],

    total:
      count ?? 0,
  };
}


// ==========================================
// GET ONE
// ==========================================

export async function getEmployeeById(
  id: string
): Promise<Employee | null> {

  const {
    data,
    error,
  } = await supabase
    .from(TABLE)
    .select("*")
    .eq(
      "employeeID",
      id
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Employee | null;
}


// ==========================================
// CREATE EMPLOYEE PROFILE
// ==========================================

export async function createEmployee(
  employee: CreateEmployeeDto
): Promise<Employee> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      ...employee,

      // Employee is enabled immediately
      isActive: true,

      // Authentication account has not been created yet
      auth_id: null,
      activation_sent_at: null,
      activation_completed_at: null,
    })
    .select()
    .single();

  if (error) {
    console.error("Create employee error:", error);
    throw error;
  }

  return data as Employee;
}

export async function activateEmployeeAccount(
  id: string
): Promise<Employee> {
  const {
    data: employee,
    error: employeeError,
  } = await supabase
    .from(TABLE)
    .select("*")
    .eq("employeeID", id)
    .maybeSingle();

  if (employeeError) {
    throw employeeError;
  }

  if (!employee) {
    throw new Error("Employee not found");
  }

  if (!employee.emailAddress) {
    throw new Error(
      "Employee does not have an email address"
    );
  }

  const appUrl = process.env.APP_URL;

  if (!appUrl) {
    throw new Error(
      "APP_URL environment variable is missing"
    );
  }

  // For this first working version, do not delete or replace
  // an existing Auth user. That will be handled by a separate,
  // safe resend flow later.
  if (employee.auth_id) {
    throw new Error(
      "Activation email has already been sent"
    );
  }

  const {
    data: inviteData,
    error: inviteError,
  } = await supabase.auth.admin.inviteUserByEmail(
    employee.emailAddress,
    {
      data: {
        employeeName: employee.employeeName,
        role: employee.role,
        employeeID: employee.employeeID,
      },
      redirectTo: `${appUrl}/set-password`,
    }
  );

  if (inviteError) {
    console.error(
      "Supabase invitation error:",
      inviteError
    );

    throw new Error(
      inviteError.message ||
        "Failed to send activation email"
    );
  }

  if (!inviteData.user) {
    throw new Error(
      "Failed to create employee authentication account"
    );
  }

  const {
    data: updatedEmployee,
    error: updateError,
  } = await supabase
    .from(TABLE)
    .update({
      auth_id: inviteData.user.id,
      isActive: true,
      activation_sent_at: new Date().toISOString(),
    })
    .eq("employeeID", id)
    .select()
    .single();

  if (updateError) {
    const { error: rollbackError } =
      await supabase.auth.admin.deleteUser(
        inviteData.user.id
      );

    if (rollbackError) {
      console.error(
        "Failed to roll back Auth user:",
        rollbackError
      );
    }

    throw updateError;
  }

  return updatedEmployee as Employee;
}

// ==========================================
// UPDATE EMPLOYEE
// ==========================================

export async function updateEmployee(
  id: string,
  employee: UpdateEmployeeDto
): Promise<Employee | null> {

  const {
    data,
    error,
  } = await supabase
    .from(TABLE)
    .update(employee)
    .eq(
      "employeeID",
      id
    )
    .select()
    .maybeSingle();


  if (error) {
    throw error;
  }


  return data as Employee | null;
}


// ==========================================
// DELETE EMPLOYEE
// ==========================================

export async function deleteEmployee(
  id: string
): Promise<Employee | null> {

  // ========================================
  // 1. GET EMPLOYEE FIRST
  // ========================================

  const {
    data: existingEmployee,
    error: lookupError,
  } = await supabase
    .from(TABLE)
    .select("*")
    .eq(
      "employeeID",
      id
    )
    .maybeSingle();


  if (lookupError) {
    throw lookupError;
  }


  if (!existingEmployee) {
    return null;
  }


  // ========================================
  // 2. DELETE EMPLOYEE RECORD
  // ========================================

  const {
    data,
    error,
  } = await supabase
    .from(TABLE)
    .delete()
    .eq(
      "employeeID",
      id
    )
    .select()
    .maybeSingle();


  if (error) {
    throw error;
  }


  // ========================================
  // 3. DELETE LINKED AUTH USER
  // ========================================

  if (
    existingEmployee.auth_id
  ) {

    const {
      error: authDeleteError,
    } =
      await supabase.auth.admin
        .deleteUser(
          existingEmployee.auth_id
        );


    if (authDeleteError) {

      console.error(
        "Failed to delete Auth user:",
        authDeleteError
      );
    }
  }


  return data as Employee | null;
}