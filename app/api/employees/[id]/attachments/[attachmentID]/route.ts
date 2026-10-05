import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/app/lib/auth";
import { EMPLOYEE_ROLE } from "@/app/lib/enums";
import { employeeIdSchema } from "@/app/schemas/employee/employee.schema";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import { removeEmployeeAttachment } from "@/services/storage/employeeAttachmentService";

// Removing one of an employee's files. Admin only, as adding one is.

type RouteContext = { params: Promise<{ id: string; attachmentID: string }> };

export async function DELETE(request: Request, { params }: RouteContext) {
  const { auth, response } = await authorize(request, [EMPLOYEE_ROLE.admin]);
  if (response) return response;

  const { id, attachmentID } = await params;
  const employee = employeeIdSchema.safeParse(id);
  const attachment = z.string().uuid().safeParse(attachmentID);
  if (!employee.success || !attachment.success) {
    return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
  }

  try {
    const removed = await removeEmployeeAttachment(employee.data, attachment.data);
    if (!removed) {
      return NextResponse.json({ message: "That file no longer exists" }, { status: 404 });
    }

    await recordAudit({
      table: "Employee",
      recordID: employee.data,
      action: "ATTACHMENT_REMOVE",
      actor: auditActor(auth),
      before: { attachmentID: attachment.data },
    });

    return NextResponse.json({ message: "Attachment removed" });
  } catch (error) {
    console.error("[Employee attachments DELETE]:", error);
    return NextResponse.json({ message: "Could not remove that file" }, { status: 500 });
  }
}
