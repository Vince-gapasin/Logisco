import { z } from "zod";
import { normalizePhone } from "@/app/lib/bookingRules";
import { EMAIL_RULE } from "@/app/lib/emailRule";
import { checkEmployeeFields, type EmployeeFields } from "@/app/lib/employeeRules";

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

const employeeObject = z
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
      .email(EMAIL_RULE),

    employeeCode: z.string().nullable().optional(),
    auth_id: z.string().uuid().nullable().optional(),
    isActive: z.boolean().nullable().optional(),

    birthdate: z.string().nullable().optional(),
    firstName: z.string().trim().nullable().optional(),
    middleName: z.string().nullable().optional(),
    lastName: z.string().trim().nullable().optional(),
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

// The record's fields checked as a whole, by the same rules the employee form
// uses: phone numbers that are phone numbers, dates that exist and have
// happened, and a new driver whose license has not expired. A warning - an
// existing driver's expired license on an edit - is the form's to show; it
// does not stop the save here.
const checkFields = (creating: boolean) => (fields: Record<string, unknown>, ctx: z.RefinementCtx) => {
  for (const issue of checkEmployeeFields(fields as EmployeeFields, { creating })) {
    if (issue.warning) continue;
    ctx.addIssue({ code: "custom", message: issue.message, path: [issue.field] });
  }
};

// Phone numbers stored as 09XXXXXXXXX, as every other number in the system.
const normalizePhones = <T extends { contact?: string | null; emergencyContactNumber?: string | null }>(fields: T): T => ({
  ...fields,
  ...(fields.contact ? { contact: normalizePhone(fields.contact) ?? fields.contact } : {}),
  ...(fields.emergencyContactNumber
    ? { emergencyContactNumber: normalizePhone(fields.emergencyContactNumber) ?? fields.emergencyContactNumber }
    : {}),
});

export const createEmployeeSchema = employeeObject.superRefine(checkFields(true)).transform(normalizePhones);

export const updateEmployeeSchema = employeeObject
  .omit({
    employeeID: true,
    emailAddress: true,
  })
  .partial()
  .superRefine(checkFields(false))
  .transform(normalizePhones);

export const employeeIdSchema = z
  .string()
  .uuid("Employee ID must be a valid UUID");