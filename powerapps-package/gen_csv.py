#!/usr/bin/env python3
"""Generate CSV table templates for Power Apps' "create table from Excel/CSV" flow.

This is the canonical tool for adding tables to the GC Mission Control Power Apps
migration. Hand-authoring Dataverse solution XML to create new tables was tried and
confirmed unsupported by Microsoft (see README.md); CSV import is the mechanism that
actually works, proven by the Phase 1 tables. Add each new phase's entities to
PHASES below (field lists trimmed from the real base44/entities/*.jsonc - nested
arrays/objects don't map to flat columns, so pick the scalar fields that matter).

Usage: python3 gen_csv.py <phase_number>
Output: csv-tables/phase<N>/<table>.csv, plus prints the lookup-column fixup list
for the README.
"""
import csv
import sys
import os

OUT_ROOT = "csv-tables"

# field types: text(len), memo, bool, decimal, date, lookup(target_phase_key)
PHASES = {
    1: {
        # Already delivered and imported by the user - kept here for regeneration only.
        "job": {
            "display": "Job", "fields": [
                ("job_reference", "text200", "Job Reference"),
                ("location", "text200", "Location"),
                ("status", "text100", "Status"),
                ("job_type", "text100", "Job Type"),
                ("start_date", "date", "Start Date"),
                ("end_date", "date", "End Date"),
                ("client", "lookup:client", "Client"),
                ("contractor", "lookup:contractor", "Contractor"),
                ("project_manager", "text200", "Project Manager"),
                ("site_contact_name", "text200", "Site Contact Name"),
                ("site_contact_phone", "text100", "Site Contact Phone"),
                ("budget_amount", "decimal", "Budget Amount"),
                ("actual_cost", "decimal", "Actual Cost"),
                ("meterage", "decimal", "Meterage"),
                ("portal_enabled", "bool", "Portal Enabled"),
                ("notes", "memo", "Notes"),
            ],
        },
        "siteasset": {
            "display": "Site Asset", "fields": [
                ("asset_type", "text100", "Asset Type"),
                ("equipment_type", "text200", "Equipment Type"),
                ("serial_number", "text200", "Serial Number"),
                ("fleet_number", "text100", "Fleet Number"),
                ("make", "text200", "Make"),
                ("model", "text200", "Model"),
                ("is_rig", "bool", "Is Rig"),
                ("colour", "text100", "Colour"),
                ("compliance_status", "text100", "Compliance Status"),
                ("compliance_expiry_date", "date", "Compliance Expiry Date"),
                ("last_service_date", "date", "Last Service Date"),
                ("next_service_date", "date", "Next Service Date"),
                ("responsible_person", "text200", "Responsible Person"),
                ("storage_location", "text200", "Storage Location"),
                ("is_active", "bool", "Is Active"),
                ("cost_price", "decimal", "Cost Price"),
                ("charge_out_price", "decimal", "Charge Out Price"),
                ("notes", "memo", "Notes"),
            ],
        },
        "staff": {
            "display": "Staff Member", "fields": [
                ("email", "text200", "Email"),
                ("phone", "text100", "Phone"),
                ("job_title", "text200", "Job Title"),
                ("worker_type", "text100", "Worker Type"),
                ("company", "text200", "Company"),
                ("day_rate", "decimal", "Day Rate"),
                ("agency", "lookup:contractor", "Agency"),
                ("manager", "lookup:staff", "Manager"),
                ("team_id", "text100", "Team"),
                ("system_role", "text100", "System Role"),
                ("ni_number", "text50", "NI Number"),
                ("date_of_birth", "date", "Date of Birth"),
                ("is_active", "bool", "Is Active"),
            ],
        },
        "client": {
            "display": "Client", "fields": [
                ("parent_client", "lookup:client", "Parent Client"),
                ("is_holding", "bool", "Is Holding Company"),
                ("contact_name", "text200", "Contact Name"),
                ("contact_email", "text200", "Contact Email"),
                ("contact_phone", "text100", "Contact Phone"),
                ("yard_address", "text400", "Yard Address"),
                ("is_partner", "bool", "Is Partner"),
            ],
        },
        "contractor": {
            "display": "Contractor", "fields": [
                ("contractor_type", "text100", "Contractor Type"),
                ("contact_name", "text200", "Contact Name"),
                ("contact_email", "text200", "Contact Email"),
                ("contact_phone", "text100", "Contact Phone"),
                ("onboarding_status", "text100", "Onboarding Status"),
                ("company_reg_number", "text100", "Company Reg Number"),
                ("vat_number", "text100", "VAT Number"),
                ("insurance_provider", "text200", "Insurance Provider"),
                ("insurance_expiry", "date", "Insurance Expiry"),
                ("default_daily_rate", "decimal", "Default Daily Rate"),
                ("cis_status", "text100", "CIS Status"),
                ("notes", "memo", "Notes"),
            ],
        },
        "jobassetassignment": {
            "display": "Job Asset Assignment", "fields": [
                ("job", "lookup:job", "Job"),
                ("asset", "lookup:siteasset", "Asset"),
                ("vehicle", "lookup:siteasset", "Vehicle"),
                ("role", "text100", "Role"),
                ("status", "text100", "Status"),
                ("assigned_date", "date", "Assigned Date"),
                ("arrived_on_site_date", "date", "Arrived On Site Date"),
                ("returned_date", "date", "Returned Date"),
                ("notes", "memo", "Notes"),
            ],
        },
    },
    2: {
        "team": {
            "display": "Team", "fields": [
                ("description", "text400", "Description"),
                ("parent_team", "lookup:team", "Parent Team"),
                ("job_type", "text100", "Discipline"),
                ("category", "text100", "Category"),
                ("revenue_stream_type", "text100", "Revenue Stream Type"),
                ("billing_default_markup", "decimal", "Billing Default Markup %"),
                ("supervisor_staff", "lookup:staff", "Supervisor"),
                ("is_supervisor_team", "bool", "Is Supervisor Team"),
            ],
        },
        "rotaweek": {
            "display": "Rota Week", "fields": [
                ("week_start", "date", "Week Start"),
                ("status", "text100", "Status"),
                ("published_at", "date", "Published At"),
                ("superseded", "bool", "Superseded"),
            ],
        },
        "rotaassignment": {
            # Trimmed from 49 real fields to the core scheduling set - the rest
            # (Mitti audit timestamps, signature data URLs, detailed travel-time
            # breakdowns etc.) can be added in a later phase if actually needed.
            "display": "Rota Assignment", "fields": [
                ("job", "lookup:job", "Job"),
                ("staff", "lookup:staff", "Staff"),
                ("vehicle", "lookup:siteasset", "Vehicle"),
                ("rig_asset", "lookup:siteasset", "Rig Asset"),
                ("assigned_date", "date", "Assigned Date"),
                ("week_start", "date", "Week Start"),
                ("assignment_type", "text100", "Assignment Type"),
                ("non_job_label", "text200", "Non-Job Label"),
                ("status", "text100", "Status"),
                ("start_time", "text50", "Start Time"),
                ("end_time", "text50", "End Time"),
                ("shift_status", "text100", "Shift Status"),
                ("is_overtime", "bool", "Is Overtime"),
                ("rate_multiplier", "decimal", "Rate Multiplier"),
                ("meterage", "decimal", "Meterage"),
                ("notes", "memo", "Notes"),
            ],
        },
        "staffshift": {
            "display": "Staff Shift Pattern", "fields": [
                ("staff", "lookup:staff", "Staff"),
                ("day_of_week", "decimal", "Day of Week (0=Sun)"),
                ("start_time", "text50", "Start Time"),
                ("end_time", "text50", "End Time"),
            ],
        },
        "absence": {
            "display": "Absence", "fields": [
                ("staff", "lookup:staff", "Staff"),
                ("start_date", "date", "Start Date"),
                ("end_date", "date", "End Date"),
                ("reason", "text200", "Reason"),
                ("notes", "memo", "Notes"),
                ("status", "text100", "Status"),
                ("approved_by", "text200", "Approved By"),
                ("approved_at", "date", "Approved At"),
                ("source", "text100", "Source"),
            ],
        },
        "trainingcourse": {
            "display": "Training Course", "fields": [
                ("category", "text200", "Category"),
                ("provider", "text200", "Provider"),
                ("venue", "text200", "Venue"),
                ("address", "text400", "Address"),
                ("start_date", "date", "Start Date"),
                ("end_date", "date", "End Date"),
                ("start_time", "text50", "Start Time"),
                ("end_time", "text50", "End Time"),
                ("description", "memo", "Description"),
                ("status", "text100", "Status"),
                ("default_expiry_months", "decimal", "Default Expiry (months)"),
            ],
        },
        "trainingrequirement": {
            "display": "Training Requirement", "fields": [
                ("short_code", "text50", "Short Code"),
                ("qualification_type", "text100", "Qualification Type"),
                ("requires_front_back", "bool", "Requires Front/Back Image"),
                ("is_card", "bool", "Is Card"),
                ("icon", "text100", "Icon"),
                ("color", "text50", "Colour"),
                ("sort_order", "decimal", "Sort Order"),
                ("is_active", "bool", "Is Active"),
            ],
        },
        "cvr": {
            "display": "CVR (Cost Value Report)", "fields": [
                ("job", "lookup:job", "Job"),
                ("client_name", "text200", "Client Name"),
                ("contract_value", "decimal", "Contract Value"),
                ("variations_total", "decimal", "Variations Total"),
                ("budget", "decimal", "Budget"),
                ("forecast_final_value", "decimal", "Forecast Final Value"),
                ("total_cost", "decimal", "Total Cost"),
                ("profit_loss", "decimal", "Profit / Loss"),
                ("profit_pct", "decimal", "Profit %"),
                ("project_start", "date", "Project Start"),
                ("project_end", "date", "Project End"),
                ("costs_to_date", "decimal", "Costs to Date"),
                ("value_to_date", "decimal", "Value to Date"),
                ("last_updated_at", "date", "Last Updated At"),
                ("last_updated_by", "text200", "Last Updated By"),
            ],
        },
    },
}

# Display name lookup across ALL phases, so a Phase 2 lookup can point at a
# Phase 1 table (e.g. RotaAssignment.Job -> Job) with the right display name.
DISPLAY_NAMES = {key: spec["display"] for phase in PHASES.values() for key, spec in phase.items()}

SAMPLE = {
    "text50": ["ABC123", "XYZ789"],
    "text100": ["Sample value one", "Sample value two"],
    "text200": ["Sample value one", "Sample value two"],
    "text400": ["123 Example Street, Sample Town, SM1 2PL", "456 Other Road, Othertown, OT9 8ZZ"],
    "memo": ["Free-text notes go here, can be a longer paragraph.", "More free-text notes as a second example."],
    "bool": ["Yes", "No"],
    "decimal": ["1000.00", "2500.50"],
    "date": ["2026-01-15", "2026-02-20"],
}


def main():
    if len(sys.argv) != 2 or not sys.argv[1].isdigit():
        print("Usage: python3 gen_csv.py <phase_number>")
        sys.exit(1)
    phase_num = int(sys.argv[1])
    if phase_num not in PHASES:
        print(f"No phase {phase_num} defined in PHASES.")
        sys.exit(1)

    out_dir = f"{OUT_ROOT}/phase{phase_num}"
    os.makedirs(out_dir, exist_ok=True)

    lookup_notes = {}

    for key, spec in PHASES[phase_num].items():
        display = spec["display"]
        headers = [f"{display} Name"]
        row1, row2 = ["Example One"], ["Example Two"]
        lookups = []
        for field_name, ftype, fdisplay in spec["fields"]:
            headers.append(fdisplay)
            if ftype.startswith("lookup:"):
                target = ftype.split(":", 1)[1]
                row1.append("(leave blank for now)")
                row2.append("(leave blank for now)")
                lookups.append((fdisplay, DISPLAY_NAMES.get(target, target)))
            else:
                base = ftype[:4] if ftype.startswith("text") else ftype
                samples = SAMPLE.get(ftype, SAMPLE.get(base, ["Sample", "Sample"]))
                row1.append(samples[0])
                row2.append(samples[1])
        fname = f"{out_dir}/{key}.csv"
        with open(fname, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(headers)
            w.writerow(row1)
            w.writerow(row2)
        if lookups:
            lookup_notes[display] = lookups
        print(f"wrote {fname} ({len(headers)} columns)")

    print()
    print(f"=== Phase {phase_num} lookup columns to convert after import ===")
    for display, lookups in lookup_notes.items():
        for fdisplay, target in lookups:
            print(f"  {display}.{fdisplay} -> Lookup to {target}")


if __name__ == "__main__":
    main()
