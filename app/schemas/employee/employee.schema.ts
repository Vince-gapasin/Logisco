import { z } from "zod";

export const employeeQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1),

  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10),

  search: z
    .string()
    .trim()
    .optional(),

  role: z
    .string()
    .trim()
    .optional(),

  availability: z
    .string()
    .trim()
    .optional(),

  healthStatus: z
    .string()
    .trim()
    .optional(),

  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),

  sortBy: z
    .enum([
      "employeeName",
      "employeeCode",
      "dateEmployed",
    ])
    .default("employeeName"),

  sortOrder: z
    .enum(["asc", "desc"])
    .default("asc"),
});

export const createEmployeeSchema = z
  .object({
    employeeID: z
      .string()
      .uuid("Employee ID must be a valid UUID"),

    employeeName: z
      .string()
      .trim()
      .min(1, "Employee name is required"),

    role: z
      .string()
      .trim()
      .min(1, "Role is required"),

    availability: z
      .string()
      .trim()
      .min(1, "Availability is required"),

    healthStatus: z
      .string()
      .trim()
      .min(1, "Health status is required"),

    address: z
      .string()
      .trim()
      .min(1, "Address is required"),

    contact: z
      .string()
      .trim()
      .min(1, "Contact is required"),

    emailAddress: z
      .string()
      .trim()
      .email("Invalid email address"),

    employeeCode: z.string().nullable().optional(),
    auth_id: z.string().uuid().nullable().optional(),
    isActive: z.boolean().nullable().optional(),

    birthdate: z.string().nullable().optional(),
    middleName: z.string().nullable().optional(),
    suffix: z.string().nullable().optional(),
    gender: z.string().nullable().optional(),
    bloodType: z.string().nullable().optional(),
    nationality: z.string().nullable().optional(),
    religion: z.string().nullable().optional(),

    dateEmployed: z.string().nullable().optional(),

    driverLicenseType: z.string().nullable().optional(),
    licenseNumber: z.string().nullable().optional(),
    licenseExpirationDate: z.string().nullable().optional(),

    drivingExperience: z
      .number()
      .int()
      .min(0)
      .nullable()
      .optional(),

    drugTestStatus: z.string().nullable().optional(),
    lastMedicalCheckup: z.string().nullable().optional(),

    emergencyContactPerson: z.string().nullable().optional(),
    emergencyContactNumber: z.string().nullable().optional(),
    relationship: z.string().nullable().optional(),

    skills: z.string().nullable().optional(),
    remarks: z.string().nullable().optional(),
  })
  .strict();
  
export const updateEmployeeSchema =
  createEmployeeSchema
    .omit({
      employeeID: true,
      emailAddress: true,
    })
    .partial();

export const employeeIdSchema = z
  .string()
  .uuid("Employee ID must be a valid UUID");