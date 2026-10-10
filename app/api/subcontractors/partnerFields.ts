// The Clients & Partners page sends a partner as { companyName, ... } while the
// partner rules (createPartnerSchema) call the company "name". These turn one
// into the other, so the routes can hold a partner to those rules without the
// page or the stored columns changing.

type PartnerBody = Record<string, unknown>;

/** The page's fields, as the partner rules name them. Fields not sent stay unsent. */
export function partnerFields(body: PartnerBody): PartnerBody {
  const fields: PartnerBody = {
    name: body.companyName,
    contractType: body.contractType,
    contactPerson: body.contactPerson,
    contactNumber: body.contactNumber,
    emailAddress: body.emailAddress,
    businessAddress: body.businessAddress,
  };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

/** Back to the names the subcontractor service saves under. */
export function fromPartnerFields(fields: PartnerBody): PartnerBody {
  const { name, ...rest } = fields;
  return name === undefined ? rest : { companyName: name, ...rest };
}
