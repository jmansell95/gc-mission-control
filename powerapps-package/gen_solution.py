#!/usr/bin/env python3
"""Generate Dataverse solution source (Entities/*, Relationships.xml, Solution.xml RootComponents)
for the GC Mission Control Phase 1 Power Platform package, from a declarative schema."""
import os

PREFIX = "gc"
SRC = "./solution/src"

# ---------------------------------------------------------------------------
# Schema definition
# ---------------------------------------------------------------------------
# field types: text(len), memo, bool, decimal(precision), date, lookup(target)
ENTITIES = {
    "job": {
        "display": "Job", "plural": "Jobs",
        "desc": "Ground Control project/job record.",
        "fields": [
            ("job_reference", "text200", "Job Reference", "Project reference or PO number."),
            ("location", "text200", "Location", "Site location/address."),
            ("status", "text100", "Status", "planning / in_progress / decommissioning / completed / on_hold / cancelled."),
            ("job_type", "text100", "Job Type", "Primary discipline/type key."),
            ("start_date", "date", "Start Date", "Project start date."),
            ("end_date", "date", "End Date", "Project end date."),
            ("client", "lookup:client", "Client", "Associated client."),
            ("contractor", "lookup:contractor", "Contractor", "Associated contractor."),
            ("project_manager", "text200", "Project Manager", "Project manager responsible for the project."),
            ("site_contact_name", "text200", "Site Contact Name", "On-site contact name."),
            ("site_contact_phone", "text100", "Site Contact Phone", "On-site contact phone number."),
            ("budget_amount", "decimal", "Budget Amount", "Project budget in GBP."),
            ("actual_cost", "decimal", "Actual Cost", "Manually recorded actual cost in GBP."),
            ("meterage", "decimal", "Meterage", "Total metres drilled for drilling projects."),
            ("portal_enabled", "bool", "Portal Enabled", "Whether client portal access is enabled."),
            ("notes", "memo", "Notes", "Project notes and details."),
        ],
    },
    "siteasset": {
        "display": "Site Asset", "plural": "Site Assets",
        "desc": "Rig, trailer, machinery, lifting gear or other tracked asset.",
        "fields": [
            ("asset_type", "text100", "Asset Type", "rig / trailer / lifting / machinery / vehicle."),
            ("equipment_type", "text200", "Equipment Type", "Equipment type (e.g. Overshot Tool, Sling)."),
            ("serial_number", "text200", "Serial Number", "Manufacturer serial number, asset tag or registration."),
            ("fleet_number", "text100", "Fleet Number", "Primary fleet reference number."),
            ("make", "text200", "Make", "Manufacturer / make of the asset."),
            ("model", "text200", "Model", "Model of the asset."),
            ("is_rig", "bool", "Is Rig", "True when this asset is a drilling rig."),
            ("colour", "text100", "Colour", "Identifying colour of the asset."),
            ("compliance_status", "text100", "Compliance Status", "Current compliance status."),
            ("compliance_expiry_date", "date", "Compliance Expiry Date", "Date the asset's compliance expires."),
            ("last_service_date", "date", "Last Service Date", "Date of the last service/inspection."),
            ("next_service_date", "date", "Next Service Date", "Date the next service is due."),
            ("responsible_person", "text200", "Responsible Person", "Person responsible for this asset."),
            ("storage_location", "text200", "Storage Location", "Where the asset lives when not on a job."),
            ("is_active", "bool", "Is Active", "Whether this asset is available for job assignment."),
            ("cost_price", "decimal", "Cost Price", "Internal cost price for this asset in GBP."),
            ("charge_out_price", "decimal", "Charge Out Price", "Optional charge-out (sell) price in GBP."),
            ("notes", "memo", "Notes", "Additional notes about this asset."),
        ],
    },
    "staff": {
        "display": "Staff Member", "plural": "Staff Members",
        "desc": "Ground Control employee, agency or subcontractor worker.",
        "fields": [
            ("email", "text200", "Email", "Staff member email address."),
            ("phone", "text100", "Phone", "Staff member phone number."),
            ("job_title", "text200", "Job Title", "Staff member's job title / role."),
            ("worker_type", "text100", "Worker Type", "employee / agency / subcontractor."),
            ("company", "text200", "Company", "The company this external worker is from."),
            ("day_rate", "decimal", "Day Rate", "Internal cost price per day for this staff member."),
            ("agency", "lookup:contractor", "Agency", "Linked Contractor (Agency) record."),
            ("manager", "lookup:staff", "Manager", "Staff member who approves this person's timesheets."),
            ("team_id", "text100", "Team", "Team/group assignment."),
            ("system_role", "text100", "System Role", "App-level access role."),
            ("ni_number", "text50", "NI Number", "National Insurance Number."),
            ("date_of_birth", "date", "Date of Birth", "Staff member date of birth."),
            ("is_active", "bool", "Is Active", "Whether staff member is active."),
        ],
    },
    "client": {
        "display": "Client", "plural": "Clients",
        "desc": "Client company that commissions Ground Control work.",
        "fields": [
            ("parent_client", "lookup:client", "Parent Client", "Parent group client."),
            ("is_holding", "bool", "Is Holding Company", "True when this client is a parent/holding group."),
            ("contact_name", "text200", "Contact Name", "Primary contact person."),
            ("contact_email", "text200", "Contact Email", "Contact email."),
            ("contact_phone", "text100", "Contact Phone", "Contact phone number."),
            ("yard_address", "text400", "Yard Address", "Address of the client's yard, depot or collection point."),
            ("is_partner", "bool", "Is Partner", "True when this client is a partner consultancy."),
        ],
    },
    "contractor": {
        "display": "Contractor", "plural": "Contractors",
        "desc": "Sub-contractor or agency supplying labour/plant to Ground Control.",
        "fields": [
            ("contractor_type", "text100", "Contractor Type", "subcontractor / agency."),
            ("contact_name", "text200", "Contact Name", "Primary contact person."),
            ("contact_email", "text200", "Contact Email", "Contact email address."),
            ("contact_phone", "text100", "Contact Phone", "Contact phone number."),
            ("onboarding_status", "text100", "Onboarding Status", "Onboarding lifecycle status."),
            ("company_reg_number", "text100", "Company Reg Number", "Companies House registration number."),
            ("vat_number", "text100", "VAT Number", "VAT registration number."),
            ("insurance_provider", "text200", "Insurance Provider", "Name of the public liability insurer."),
            ("insurance_expiry", "date", "Insurance Expiry", "Expiry date of the public liability insurance policy."),
            ("default_daily_rate", "decimal", "Default Daily Rate", "Default daily charge rate for this contractor's crew."),
            ("cis_status", "text100", "CIS Status", "HMRC CIS verification result."),
            ("notes", "memo", "Notes", "Additional notes."),
        ],
    },
    "jobassetassignment": {
        "display": "Job Asset Assignment", "plural": "Job Asset Assignments",
        "desc": "Links a Site Asset to a Job for a period of time.",
        "fields": [
            ("job", "lookup:job", "Job", "Job this asset is assigned to."),
            ("asset", "lookup:siteasset", "Asset", "Site Asset assigned to this job."),
            ("vehicle", "lookup:siteasset", "Vehicle", "Vehicle the gear was loaded onto when signed out."),
            ("role", "text100", "Role", "Role this asset plays on the job (primary_rig / trailer / lifting / machinery)."),
            ("status", "text100", "Status", "assigned / on_site / returned."),
            ("assigned_date", "date", "Assigned Date", "Date the asset was assigned to the job."),
            ("arrived_on_site_date", "date", "Arrived On Site Date", "Date the asset arrived on site."),
            ("returned_date", "date", "Returned Date", "Date the asset was returned / off-hired."),
            ("notes", "memo", "Notes", "Notes about this asset assignment."),
        ],
    },
}

# Explicit relationship schema names must be unique when the same pair of
# entities relates more than once (e.g. JobAssetAssignment -> SiteAsset twice).
REL_NAME_OVERRIDES = {
    ("siteasset", "jobassetassignment", "vehicle"): f"{PREFIX}_siteasset_jobassetassignment_vehicle",
}

def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
             .replace('"', "&quot;"))

def attr_xml(field_name, ftype, display, desc):
    logical = f"{PREFIX}_{field_name}"
    physical = f"{PREFIX}_{''.join(w.capitalize() for w in field_name.split('_'))}"
    common = (
        f'      <LogicalName>{logical}</LogicalName>\n'
        f'      <RequiredLevel>none</RequiredLevel>\n'
        f'      <IsCustomField>1</IsCustomField>\n'
        f'      <DisplayNames>\n'
        f'        <DisplayName description="{esc(display)}" languagecode="1033" />\n'
        f'      </DisplayNames>\n'
        f'      <Descriptions>\n'
        f'        <Description description="{esc(desc)}" languagecode="1033" />\n'
        f'      </Descriptions>\n'
    )
    if ftype.startswith("text"):
        length = ftype[4:] or "200"
        return (
            f'    <attribute PhysicalName="{physical}">\n'
            f'      <Type>nvarchar</Type>\n'
            f'      <Name>{logical}</Name>\n'
            f'{common}'
            f'      <Length>{length}</Length>\n'
            f'      <Format>text</Format>\n'
            f'      <ImeMode>auto</ImeMode>\n'
            f'    </attribute>\n'
        )
    if ftype == "memo":
        return (
            f'    <attribute PhysicalName="{physical}">\n'
            f'      <Type>ntext</Type>\n'
            f'      <Name>{logical}</Name>\n'
            f'{common}'
            f'      <Length>4000</Length>\n'
            f'      <Format>textarea</Format>\n'
            f'      <ImeMode>auto</ImeMode>\n'
            f'    </attribute>\n'
        )
    if ftype == "bool":
        return (
            f'    <attribute PhysicalName="{physical}">\n'
            f'      <Type>bit</Type>\n'
            f'      <Name>{logical}</Name>\n'
            f'{common}'
            f'      <defaultvalue>0</defaultvalue>\n'
            f'      <LocLabels>\n'
            f'        <LocLabel languagecode="1033">\n'
            f'          <Value1 Text="Yes" />\n'
            f'          <Value0 Text="No" />\n'
            f'        </LocLabel>\n'
            f'      </LocLabels>\n'
            f'    </attribute>\n'
        )
    if ftype == "decimal":
        return (
            f'    <attribute PhysicalName="{physical}">\n'
            f'      <Type>decimal</Type>\n'
            f'      <Name>{logical}</Name>\n'
            f'{common}'
            f'      <MinValue>-100000000</MinValue>\n'
            f'      <MaxValue>100000000</MaxValue>\n'
            f'      <Precision>2</Precision>\n'
            f'    </attribute>\n'
        )
    if ftype == "date":
        return (
            f'    <attribute PhysicalName="{physical}">\n'
            f'      <Type>datetime</Type>\n'
            f'      <Name>{logical}</Name>\n'
            f'{common}'
            f'      <Format>DateOnly</Format>\n'
            f'      <ImeMode>auto</ImeMode>\n'
            f'    </attribute>\n'
        )
    if ftype.startswith("lookup:"):
        target = ftype.split(":", 1)[1]
        target_logical = f"{PREFIX}_{target}"
        return (
            f'    <attribute PhysicalName="{physical}">\n'
            f'      <Type>lookup</Type>\n'
            f'      <Name>{logical}</Name>\n'
            f'{common}'
            f'      <LookupStyle>single</LookupStyle>\n'
            f'      <LookupTypes>\n'
            f'        <LookupType>{target_logical}</LookupType>\n'
            f'      </LookupTypes>\n'
            f'    </attribute>\n'
        )
    raise ValueError(f"unknown field type {ftype}")


def entity_xml(key, spec):
    logical = f"{PREFIX}_{key}"
    display = spec["display"]
    plural = spec["plural"]
    desc = spec["desc"]

    pk_physical = f"{PREFIX}_{key.capitalize()}Id"
    pk_logical = f"{logical}id"
    name_physical = f"{PREFIX}_Name"
    name_logical = f"{PREFIX}_name"

    attrs = []
    attrs.append(
        f'    <attribute PhysicalName="{pk_physical}">\n'
        f'      <Type>primarykey</Type>\n'
        f'      <Name>{pk_logical}</Name>\n'
        f'      <LogicalName>{pk_logical}</LogicalName>\n'
        f'      <RequiredLevel>systemrequired</RequiredLevel>\n'
        f'      <DisplayMask>ValidForForm|ValidForGrid</DisplayMask>\n'
        f'      <ImeMode>auto</ImeMode>\n'
        f'      <IsCustomField>1</IsCustomField>\n'
        f'      <IsCustomizable>0</IsCustomizable>\n'
        f'      <DisplayNames>\n'
        f'        <DisplayName description="{esc(display)}" languagecode="1033" />\n'
        f'      </DisplayNames>\n'
        f'    </attribute>\n'
    )
    attrs.append(
        f'    <attribute PhysicalName="{name_physical}">\n'
        f'      <Type>nvarchar</Type>\n'
        f'      <Name>{name_logical}</Name>\n'
        f'      <LogicalName>{name_logical}</LogicalName>\n'
        f'      <RequiredLevel>required</RequiredLevel>\n'
        f'      <IsPrimaryField>1</IsPrimaryField>\n'
        f'      <Length>200</Length>\n'
        f'      <IsCustomField>1</IsCustomField>\n'
        f'      <ImeMode>auto</ImeMode>\n'
        f'      <Format>text</Format>\n'
        f'      <DisplayNames>\n'
        f'        <DisplayName description="{esc(display)} Name" languagecode="1033" />\n'
        f'      </DisplayNames>\n'
        f'      <Descriptions>\n'
        f'        <Description description="Primary name field" languagecode="1033" />\n'
        f'      </Descriptions>\n'
        f'    </attribute>\n'
    )
    for field_name, ftype, fdisplay, fdesc in spec["fields"]:
        attrs.append(attr_xml(field_name, ftype, fdisplay, fdesc))

    attrs_xml = "".join(attrs)

    return f'''<?xml version="1.0" encoding="utf-8"?>
<Entity xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Name LocalizedName="{esc(display)}" LanguageCode="1033">{logical}</Name>
  <EntityInfo>
    <entity Name="{logical}">
      <LocalizedNames>
        <LocalizedName description="{esc(display)}" languagecode="1033" />
      </LocalizedNames>
      <LocalizedCollectionNames>
        <LocalizedCollectionName description="{esc(plural)}" languagecode="1033" />
      </LocalizedCollectionNames>
      <Descriptions>
        <Description description="{esc(desc)}" languagecode="1033" />
      </Descriptions>
      <attributes>
{attrs_xml}      </attributes>
      <EntitySetName>{logical}s</EntitySetName>
      <IsActivity>0</IsActivity>
      <IsCustomEntity>1</IsCustomEntity>
      <IsCustomizable>1</IsCustomizable>
      <IsRenameable>1</IsRenameable>
      <IsAvailableOffline>1</IsAvailableOffline>
      <OwnershipTypeMask>UserOwned</OwnershipTypeMask>
      <IsAuditEnabled>1</IsAuditEnabled>
      <IsValidForAdvancedFind>1</IsValidForAdvancedFind>
      <IsVisibleInMobile>1</IsVisibleInMobile>
      <IsVisibleInMobileClient>1</IsVisibleInMobileClient>
      <IsReadOnlyInMobileClient>0</IsReadOnlyInMobileClient>
      <IsOfflineInMobileClient>0</IsOfflineInMobileClient>
    </entity>
  </EntityInfo>
  <Roles />
  <FormXml />
  <SavedQueries />
</Entity>
'''


def main():
    os.makedirs(f"{SRC}/Entities", exist_ok=True)
    root_components = []
    relationships = []

    for key, spec in ENTITIES.items():
        entdir = f"{SRC}/Entities/{PREFIX}_{key}"
        os.makedirs(entdir, exist_ok=True)
        with open(f"{entdir}/Entity.xml", "w", encoding="utf-8") as f:
            f.write(entity_xml(key, spec))
        root_components.append(f'      <RootComponent type="1" schemaName="{PREFIX}_{key}" behavior="0" />')

        for field_name, ftype, _, _ in spec["fields"]:
            if ftype.startswith("lookup:"):
                target = ftype.split(":", 1)[1]
                override_key = (target, key, field_name)
                rel_name = REL_NAME_OVERRIDES.get(
                    override_key, f"{PREFIX}_{target}_{key}"
                )
                lookup_logical = f"{PREFIX}_{field_name}"
                relationships.append(
                    f'  <EntityRelationship Name="{rel_name}">\n'
                    f'    <EntityRelationshipType>OneToMany</EntityRelationshipType>\n'
                    f'    <IsCustomizable>1</IsCustomizable>\n'
                    f'    <IsValidForAdvancedFind>0</IsValidForAdvancedFind>\n'
                    f'    <ReferencingEntityName>{PREFIX}_{key}</ReferencingEntityName>\n'
                    f'    <ReferencedEntityName>{PREFIX}_{target}</ReferencedEntityName>\n'
                    f'    <CascadeAssign>NoCascade</CascadeAssign>\n'
                    f'    <CascadeDelete>RemoveLink</CascadeDelete>\n'
                    f'    <CascadeReparent>NoCascade</CascadeReparent>\n'
                    f'    <CascadeShare>NoCascade</CascadeShare>\n'
                    f'    <CascadeUnshare>NoCascade</CascadeUnshare>\n'
                    f'    <CascadeRollupView>NoCascade</CascadeRollupView>\n'
                    f'    <IsHierarchical>0</IsHierarchical>\n'
                    f'    <ReferencingAttributeName>{lookup_logical}</ReferencingAttributeName>\n'
                    f'    <RelationshipDescription>\n'
                    f'      <Descriptions />\n'
                    f'    </RelationshipDescription>\n'
                    f'    <EntityRelationshipRoles />\n'
                    f'  </EntityRelationship>\n'
                )

    with open(f"{SRC}/Other/Relationships.xml", "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n')
        f.write('<EntityRelationships xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n')
        f.write("".join(relationships))
        f.write('</EntityRelationships>\n')

    # patch Solution.xml RootComponents block
    sol_path = f"{SRC}/Other/Solution.xml"
    with open(sol_path, encoding="utf-8-sig") as f:
        sol = f.read()
    import re
    new_block = "<RootComponents>\n" + "\n".join(root_components) + "\n    </RootComponents>"
    sol = re.sub(r"<RootComponents>.*?</RootComponents>|<RootComponents\s*/>", new_block, sol, flags=re.S)
    with open(sol_path, "w", encoding="utf-8") as f:
        f.write(sol)

    print(f"Generated {len(ENTITIES)} entities, {len(relationships)} relationships.")


if __name__ == "__main__":
    main()
