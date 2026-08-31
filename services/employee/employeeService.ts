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
// CREATE EMPLOYEE + SEND INVITATION EMAIL
// ==========================================

// export async function createEmployee(
//   employee: CreateEmployeeDto
// ): Promise<Employee> {

//   // ========================================
//   // 1. MAKE SURE APP URL EXISTS
//   // ========================================

//   const appUrl =
//     process.env.APP_URL;

//   if (!appUrl) {
//     throw new Error(
//       "APP_URL environment variable is missing"
//     );
//   }


//   // ========================================
//   // 2. SEND SUPABASE INVITATION
//   // ========================================

//   const {
//     data: inviteData,
//     error: inviteError,
//   } =
//     await supabase.auth.admin
//       .inviteUserByEmail(
//         employee.emailAddress,
//         {
//           data: {
//             employeeName:
//               employee.employeeName,

//             role:
//               employee.role,
//           },

//           redirectTo:
//             `${appUrl}/set-password`,
//         }
//       );


//   if (inviteError) {
//     throw inviteError;
//   }


//   if (!inviteData.user) {
//     throw new Error(
//       "Failed to create employee authentication invitation"
//     );
//   }


//   // ========================================
//   // 3. CREATE EMPLOYEE RECORD
//   // ========================================

//   const {
//     data,
//     error,
//   } = await supabase
//     .from(TABLE)
//     .insert({
//       ...employee,

//       auth_id:
//         inviteData.user.id,

//       isActive:
//         true,
//     })
//     .select()
//     .single();


//   // ========================================
//   // 4. ROLLBACK AUTH USER IF DB INSERT FAILS
//   // ========================================

//   if (error) {

//     const {
//       error: rollbackError,
//     } =
//       await supabase.auth.admin
//         .deleteUser(
//           inviteData.user.id
//         );


//     if (rollbackError) {
//       console.error(
//         "Failed to rollback Auth user:",
//         rollbackError
//       );
//     }


//     throw error;
//   }


//   return data as Employee;
// }

export async function createEmployee(
  employee: CreateEmployeeDto
): Promise<Employee> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      ...employee,

      // Account has not been activated yet
      auth_id: null,
      isActive: false,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Employee;
}

export async function activateEmployeeAccount(
  id: string
): Promise<Employee> {
  // ==========================================
  // 1. FIND EMPLOYEE
  // ==========================================

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
    throw new Error(
      "Employee not found"
    );
  }


  // ==========================================
  // 2. CHECK IF ALREADY ACTIVATED
  // ==========================================

  if (employee.auth_id) {
    throw new Error(
      "Employee account has already been activated"
    );
  }


  if (!employee.emailAddress) {
    throw new Error(
      "Employee does not have an email address"
    );
  }


  // ==========================================
  // 3. CHECK APP URL
  // ==========================================

  const appUrl =
    process.env.APP_URL;

  if (!appUrl) {
    throw new Error(
      "APP_URL environment variable is missing"
    );
  }


  // ==========================================
  // 4. SEND INVITATION
  // ==========================================

  const {
    data: inviteData,
    error: inviteError,
  } =
    await supabase.auth.admin
      .inviteUserByEmail(
        employee.emailAddress,
        {
          data: {
            employeeName:
              employee.employeeName,

            role:
              employee.role,

            employeeID:
              employee.employeeID,
          },

          redirectTo:
            `${appUrl}/set-password`,
        }
      );

    if (inviteError) {
      console.error("SUPABASE INVITE ERROR:", {
        message: inviteError.message,
        status: inviteError.status,
        code: inviteError.code,
        name: inviteError.name,
      }
    );

  throw new Error(
    inviteError.message || "Failed to send invitation email"
  );
}


  if (!inviteData.user) {
    throw new Error(
      "Failed to create employee authentication account"
    );
  }


  // ==========================================
  // 5. LINK AUTH USER TO EMPLOYEE
  // ==========================================

  const {
    data: updatedEmployee,
    error: updateError,
  } = await supabase
    .from(TABLE)
    .update({
      auth_id:
        inviteData.user.id,

      isActive:
        true,
    })
    .eq(
      "employeeID",
      id
    )
    .select()
    .single();


  // ==========================================
  // 6. ROLLBACK IF UPDATE FAILS
  // ==========================================

  if (updateError) {
    await supabase.auth.admin.deleteUser(
      inviteData.user.id
    );

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