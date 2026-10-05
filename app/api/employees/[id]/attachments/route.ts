import { NextResponse } from "next/server";
import { authorize } from "@/app/lib/auth";
import { EMPLOYEE_ROLE } from "@/app/lib/enums";
import { employeeIdSchema } from "@/app/schemas/employee/employee.schema";
import { getEmployeeById } from "@/services/employee/employeeService";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import {
  addEmployeeAttachment,
  listEmployeeAttachments,
  whyNotStorable,
} from "@/services/storage/employeeAttachmentService";

// An employee's files.
//
// Read by the same people who may read the full record (managers, or the
// employee themselves): these are medical results and licences. Added and
// removed by an admin, who is the only one who can edit the record.

type RouteContext = { params: Promise<{ id: string }> };

// A form can hold a few certificates at once; this is not a bulk importer.
const MAX_FILES_PER_UPLOAD = 10;

export async function GET(request: Request, { params }: RouteContext) {
  const { auth, response } = await authorize(request);
  if (response) return response;

  const parsed = employeeIdSchema.safeParse((await params).id);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid employee ID" }, { status: 400 });
  }

  const isSelf = parsed.data === auth.employee.employeeID;
  const isManager = [EMPLOYEE_ROLE.admin, EMPLOYEE_ROLE.coordinator].includes(
    auth.employee.role as typeof EMPLOYEE_ROLE.admin,
  );
  if (!isSelf && !isManager) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    return NextResponse.json({ data: await listEmployeeAttachments(parsed.data) });
  } catch (error) {
    console.error("[Employee attachments GET]:", error);
    return NextResponse.json({ message: "Could not load the attachments" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const { auth, response } = await authorize(request, [EMPLOYEE_ROLE.admin]);
  if (response) return response;

  const parsed = employeeIdSchema.safeParse((await params).id);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid employee ID" }, { status: 400 });
  }

  try {
    const employee = await getEmployeeById(parsed.data);
    if (!employee) {
      return NextResponse.json({ message: "Employee not found" }, { status: 404 });
    }

    const form = await request.formData();
    const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ message: "Choose at least one file" }, { status: 400 });
    }
    if (files.length > MAX_FILES_PER_UPLOAD) {
      return NextResponse.json(
        { message: `Upload at most ${MAX_FILES_PER_UPLOAD} files at a time` },
        { status: 400 },
      );
    }

    // All checked before any is stored, so a bad file in the batch does not
    // leave half of it uploaded.
    for (const file of files) {
      const problem = whyNotStorable(file);
      if (problem) return NextResponse.json({ message: problem }, { status: 400 });
    }

    const uploaded: string[] = [];
    for (const file of files) {
      try {
        await addEmployeeAttachment(parsed.data, file, auth.employee.employeeID);
        uploaded.push(file.name);
      } catch (error) {
        console.error("[Employee attachments POST]:", error);
        const message =
          uploaded.length > 0
            ? `Uploaded ${uploaded.join(", ")}, but ${file.name} and any after it failed. Try those again.`
            : `Could not upload ${file.name}. Try again.`;
        if (uploaded.length > 0) await audit(auth, parsed.data, uploaded);
        return NextResponse.json({ message }, { status: 502 });
      }
    }

    await audit(auth, parsed.data, uploaded);
    return NextResponse.json({ message: "Attachments uploaded", uploaded }, { status: 201 });
  } catch (error) {
    console.error("[Employee attachments POST]:", error);
    return NextResponse.json({ message: "Could not upload the attachments" }, { status: 500 });
  }
}

async function audit(
  auth: Parameters<typeof auditActor>[0],
  employeeID: string,
  fileNames: string[],
) {
  await recordAudit({
    table: "Employee",
    recordID: employeeID,
    action: "ATTACHMENT_ADD",
    actor: auditActor(auth),
    after: { files: fileNames },
  });
}
