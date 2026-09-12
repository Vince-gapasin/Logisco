import { supabase } from "@/app/lib/supabase";
// EMPLOYEE_LOGIN_ACCESS_V3

import type {
  Employee,
  CreateEmployeeDto,
  UpdateEmployeeDto,
  EmployeeQueryDto,
} from "@/types/employee";

const TABLE = "Employee";
const ACTIVATION_COOLDOWN_MS = 15 * 60 * 1000;

// Only return fields required by the directory table. The complete record is
// fetched by getEmployeeById when the user opens an employee.
const LIST_COLUMNS = [
  "employeeID",
  "employeeCode",
  "employeeName",
  "middleName",
  "suffix",
  "role",
  "address",
  "contact",
  "emailAddress",
  "isActive",
  "auth_id",
  "activation_sent_at",
  "activation_completed_at",
].join(",");

export async function getEmployees(query: EmployeeQueryDto) {
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

  let dbQuery = supabase.from(TABLE).select(LIST_COLUMNS, {
    count: "exact",
  });

  if (search) {
    dbQuery = dbQuery.ilike("employeeName", `%${search}%`);
  }

  if (role) {
    dbQuery = dbQuery.eq("role", role);
  }

  if (availability) {
    dbQuery = dbQuery.eq("availability", availability);
  }

  if (healthStatus) {
    dbQuery = dbQuery.eq("healthStatus", healthStatus);
  }

  if (isActive !== undefined) {
    dbQuery = dbQuery.eq("isActive", isActive);
  }

  const { data, error, count } = await dbQuery
    .order(sortBy, { ascending: sortOrder === "asc" })
    .range(from, to);

  if (error) throw error;

  return {
    employees: (data ?? []) as unknown as Employee[],
    total: count ?? 0,
  };
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("employeeID", id)
    .maybeSingle();

  if (error) throw error;
  return data as Employee | null;
}

export async function createEmployee(
  employee: CreateEmployeeDto,
): Promise<Employee> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      ...employee,
      isActive: true,
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
  id: string,
): Promise<Employee> {
  const { data: employee, error: employeeError } = await supabase
    .from(TABLE)
    .select("*")
    .eq("employeeID", id)
    .maybeSingle();

  if (employeeError) throw employeeError;
  if (!employee) throw new Error("Employee not found");
  if (!employee.emailAddress) {
    throw new Error("Employee does not have an email address");
  }
  if (employee.activation_completed_at) {
    throw new Error("Login access has already been activated");
  }

  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  if (!appUrl) throw new Error("APP_URL environment variable is missing");

  if (employee.activation_sent_at) {
    const sentAt = new Date(employee.activation_sent_at).getTime();
    if (Number.isFinite(sentAt)) {
      const elapsed = Date.now() - sentAt;
      if (elapsed < ACTIVATION_COOLDOWN_MS) {
        const remainingMinutes = Math.ceil(
          (ACTIVATION_COOLDOWN_MS - elapsed) / 60000,
        );
        throw new Error(
          `Please wait ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"} before resending the activation email`,
        );
      }
    }
  }

  let authId: string;

  if (employee.auth_id) {
    // The invited Auth user already exists. Send a password/recovery link that
    // returns to the same set-password page instead of creating another user.
    const { error: resendError } = await supabase.auth.resetPasswordForEmail(
      employee.emailAddress,
      { redirectTo: `${appUrl}/set-password` },
    );

    if (resendError) {
      console.error("Supabase activation resend error:", resendError);
      throw new Error(
        resendError.message || "Failed to resend activation email",
      );
    }

    authId = employee.auth_id;
  } else {
    const { data: inviteData, error: inviteError } =
      await supabase.auth.admin.inviteUserByEmail(employee.emailAddress, {
        data: {
          employeeName: employee.employeeName,
          role: employee.role,
          employeeID: employee.employeeID,
        },
        redirectTo: `${appUrl}/set-password`,
      });

    if (inviteError) {
      console.error("Supabase invitation error:", inviteError);
      throw new Error(
        inviteError.message || "Failed to send activation email",
      );
    }

    if (!inviteData.user) {
      throw new Error("Failed to create employee authentication account");
    }

    authId = inviteData.user.id;
  }

  const { data: updatedEmployee, error: updateError } = await supabase
    .from(TABLE)
    .update({
      auth_id: authId,
      activation_sent_at: new Date().toISOString(),
    })
    .eq("employeeID", id)
    .select()
    .single();

  if (updateError) {
    // Only roll back a newly-created Auth user. Never delete an existing user
    // when a resend timestamp update fails.
    if (!employee.auth_id) {
      const { error: rollbackError } =
        await supabase.auth.admin.deleteUser(authId);
      if (rollbackError) {
        console.error("Failed to roll back Auth user:", rollbackError);
      }
    }
    throw updateError;
  }

  return updatedEmployee as Employee;
}

export async function updateEmployee(
  id: string,
  employee: UpdateEmployeeDto,
): Promise<Employee | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(employee)
    .eq("employeeID", id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Employee | null;
}

export async function deleteEmployee(id: string): Promise<Employee | null> {
  const { data: existingEmployee, error: lookupError } = await supabase
    .from(TABLE)
    .select("*")
    .eq("employeeID", id)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (!existingEmployee) return null;

  // Unlink the employee first so the Employee.auth_id foreign key does not
  // prevent Supabase Auth from deleting the linked user.
  if (existingEmployee.auth_id) {
    const { error: unlinkError } = await supabase
      .from(TABLE)
      .update({
        auth_id: null,
        activation_sent_at: null,
        activation_completed_at: null,
      })
      .eq("employeeID", id);

    if (unlinkError) {
      console.error("Failed to unlink employee Auth account:", unlinkError);
      throw new Error(
        "Failed to unlink employee login access. The employee was not deleted.",
      );
    }

    const { error: authDeleteError } =
      await supabase.auth.admin.deleteUser(existingEmployee.auth_id);

    if (authDeleteError) {
      const authMessage = authDeleteError.message.toLowerCase();
      const authUserAlreadyMissing =
        authDeleteError.status === 404 || authMessage.includes("user not found");

      if (!authUserAlreadyMissing) {
        console.error("Failed to delete Auth user:", authDeleteError);

        // Restore the employee's login link because Auth deletion failed.
        const { error: restoreError } = await supabase
          .from(TABLE)
          .update({
            auth_id: existingEmployee.auth_id,
            activation_sent_at: existingEmployee.activation_sent_at,
            activation_completed_at: existingEmployee.activation_completed_at,
          })
          .eq("employeeID", id);

        if (restoreError) {
          console.error("Failed to restore employee Auth link:", restoreError);
        }

        throw new Error(
          "Failed to remove employee login access. The employee was not deleted.",
        );
      }
    }
  }

  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq("employeeID", id)
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Employee | null;
}
