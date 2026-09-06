// Generates Power Fx source code for the canvas app screens.
// Covers the field-crew mobile app and the complex builders.
// Every screen includes complete control properties, gallery templates,
// and exact Dataverse column references.

export function generatePowerFxDocument() {
  return `# GC Mission Control — Canvas App Power Fx Source Pack

**Volume 3 of 5 — Canvas App Build Manual**

Generated: ${new Date().toISOString()}

This document contains the complete Power Fx source for every screen in the canvas app.
Copy each section into the corresponding screen in Power Apps Studio.

## Setup Checklist — Do This Before Pasting Any Power Fx

1. **Create the canvas app** in Power Apps Studio (make.powerapps.com → Create → Canvas app → Phone layout). Name it "GC Field Crew".
2. **Connect the Dataverse data source** — Data → Add data → Dataverse → select all tables from Volume 1 (Staffs, Jobs, RotaAssignments, InvestigationLogs, DeliveryLogs, SiteAssets, Vehicles, ComplianceItems, AFPs, AFPLineItems, etc.).
3. **Add these connectors** — Data → Add data → search and add each:
   - **Office 365 Users** (for User().Email lookups)
   - **Office 365 Outlook** (for email flows)
   - **Power Apps Notifications** (for push notifications)
4. **Add all Power Automate flows as data sources** — Data → Add data → search for each flow by name (e.g. updateMyAssignment, publishRotaWeek, resolveAssetByQR, commitBasketSignOut, populateAFPFromFieldData, submitAFPToClient). Every flowName.Run(...) reference in the Power Fx below requires the flow to be added here first.
5. **Set App.OnStart** — paste the App.OnStart block below into the App object OnStart property. Set varClientId and varRedirectUri to your Entra ID app registration values.
6. **Create the screens** listed below in order. Each screen section tells you exactly which controls to create and which property to paste each Power Fx block into.

## How to Use This Document

Each screen section below has this structure:
- **Screen name** — the screen to create in Power Apps Studio
- **Paste Target** — which control property to paste the Power Fx into (e.g. OnVisible, OnSelect, Text, Items)
- **Power Fx block** — the exact code to paste

1. Create each screen listed below.
2. For each control mentioned in the Power Fx, create that control on the screen (Button, Label, Gallery, TextInput, etc.) and name it exactly as written (e.g. btnStartShift, lblJobName, galDays).
3. Paste each Power Fx block into the matching control property.
4. For each flow reference (e.g. publishRotaWeek.Run(...)), the flow must already be added as a data source (see Setup Checklist step 4).
5. Test on mobile using the Power Apps mobile app.

## Naming Conventions

- Screens: \`<Name>Screen\` (e.g. \`ScheduleScreen\`, \`ShiftWizardScreen\`)
- Galleries: \`gal<Name>\` (e.g. \`galDays\`, \`galAssignments\`)
- Labels: \`lbl<Name>\` (e.g. \`lblJobName\`, \`lblStatus\`)
- Buttons: \`btn<Name>\` (e.g. \`btnStartShift\`, \`btnSaveLog\`)
- Text inputs: \`txt<Name>\` (e.g. \`txtBoreholeRef\`, \`txtDepthFrom\`)
- Icons: \`icn<Name>\` (e.g. \`icnChevronRight\`)
- Timers: \`timer<Name>\` (e.g. \`timerRefresh\`)
- Dataverse tables use the \`gc_\` prefix (e.g. \`gc_staff\`, \`gc_job\`) — referenced in Power Fx as \`Staffs\`, \`Jobs\`, etc. (the plural display name)

---

## App (App object — global variables and startup)

**Paste Target:** Select the **App** object in the tree view → **OnStart** property.

\`\`\`powerapps
App.OnStart =
    // Load current user from Dataverse (gc_staff table, displayed as "Staffs")
    Set(varCurrentUser, LookUp(Staffs, gc_email = User().Email));
    
    // Determine landing page based on permission group
    If(!IsBlank(varCurrentUser),
        Set(varLandingPage,
            Switch(varCurrentUser.gc_permission_group_id.Name,
                "Super Admin", "AdminDashboardScreen",
                "Admin", "AdminDashboardScreen",
                "Office", "AdminDashboardScreen",
                "Field", "ScheduleScreen",
                "Read Only", "AdminDashboardScreen"
            )
        );
        Navigate(varLandingPage, ScreenTransition.None);
    ,
        // Not registered — show pending access
        Navigate(PendingAccessScreen, ScreenTransition.None)
    );
    
    // Global collections for offline sync
    ClearCollect(colPendingSyncs, []);
    ClearCollect(colOfflineLogs, []);
    ClearCollect(colOfflinePhotos, []);
    
    // Connection status
    Set(varIsOnline, Connection.Connected);
    
    // Week start (Monday of current week)
    Set(varWeekStart, Today() - Weekday(Today(), StartOfWeek.Monday) + 1);
    
    // App theme colors (Ground Control brand)
    Set(varBrandDark, ColorValue("#2E5A1A"));
    Set(varBrandLeaf, ColorValue("#8DC63F"));
    Set(varBrandLight, ColorValue("#F0FDF4"));
\`\`\`

---

## Screen: LoginScreen

**Paste Target:** Create a screen named **LoginScreen**. Add a button named **btnMicrosoftSignIn**. Paste into the screen **OnVisible** and the button **OnSelect** / property fields.

\`\`\`powerapps
LoginScreen.OnVisible =
    // Auto-redirect if already logged in
    If(!IsBlank(varCurrentUser), Navigate(varLandingPage, ScreenTransition.None));

// Microsoft SSO button
btnMicrosoftSignIn.OnSelect =
    Launch("https://login.microsoftonline.com/common/oauth2/v2.0/authorize?" &
           "client_id=" & varClientId &
           "&response_type=code" &
           "&redirect_uri=" & varRedirectUri &
           "&scope=openid+profile+email+offline_access" &
           "&prompt=select_account");

// Control properties
btnMicrosoftSignIn.Text: "Continue with Microsoft"
btnMicrosoftSignIn.Color: RGBA(255, 255, 255, 1)
btnMicrosoftSignIn.Fill: RGBA(46, 90, 26, 1)  // Brand dark green
btnMicrosoftSignIn.Size: 18
btnMicrosoftSignIn.RadiusBottomLeft: 12
btnMicrosoftSignIn.RadiusBottomRight: 12
btnMicrosoftSignIn.RadiusTopLeft: 12
btnMicrosoftSignIn.RadiusTopRight: 12
\`\`\`

---

## Screen: ScheduleScreen (Field crew weekly schedule)

**Paste Target:** Create a screen named **ScheduleScreen**. Add galleries **galDays** and **galAssignments**, buttons **btnPrevWeek**, **btnNextWeek**, **btnStartShift**, **btnAcknowledge**, labels **lblWeekLabel**, **lblJobName**, **lblLocation**, **lblStatus**. Paste each block into the matching control property.

\`\`\`powerapps
ScheduleScreen.OnVisible =
    // Load this week's assignments for the current user
    ClearCollect(colMyRota,
        Filter(RotaAssignments,
            gc_staff_id = varCurrentUser.gc_staffid &&
            gc_week_start = varWeekStart
        )
    );
    
    // Load jobs for display (only active jobs)
    ClearCollect(colJobs, Filter(Jobs, gc_status = "in_progress" || gc_status = "planning"));

// Week navigation — Previous
btnPrevWeek.OnSelect =
    Set(varWeekStart, DateAdd(varWeekStart, -7, Days));
    ClearCollect(colMyRota,
        Filter(RotaAssignments,
            gc_staff_id = varCurrentUser.gc_staffid &&
            gc_week_start = varWeekStart
        )
    );

// Week navigation — Next
btnNextWeek.OnSelect =
    Set(varWeekStart, DateAdd(varWeekStart, 7, Days));
    ClearCollect(colMyRota,
        Filter(RotaAssignments,
            gc_staff_id = varCurrentUser.gc_staffid &&
            gc_week_start = varWeekStart
        )
    );

// Week label
lblWeekLabel.Text: Text(varWeekStart, "dd MMM") & " — " & Text(DateAdd(varWeekStart, 6, Days), "dd MMM yyyy")
lblWeekLabel.Size: 16
lblWeekLabel.FontWeight: FontWeight.Bold

// Day gallery — shows Monday to Friday (horizontal)
galDays.Items =
    Table(
        {Day: "Mon", Date: varWeekStart, Index: 0},
        {Day: "Tue", Date: DateAdd(varWeekStart, 1, Days), Index: 1},
        {Day: "Wed", Date: DateAdd(varWeekStart, 2, Days), Index: 2},
        {Day: "Thu", Date: DateAdd(varWeekStart, 3, Days), Index: 3},
        {Day: "Fri", Date: DateAdd(varWeekStart, 4, Days), Index: 4}
    );

galDays.TemplateSize: 140
galDays.TemplateFill: If(ThisItem.Date = Today(), ColorValue("#F0FDF4"), RGBA(255, 255, 255, 1))

// Day header label (inside galDays template)
lblDayName.Text: ThisItem.Day
lblDayName.Size: 12
lblDayName.FontWeight: FontWeight.Bold
lblDayName.Color: If(ThisItem.Date = Today(), ColorValue("#2E5A1A"), RGBA(100, 116, 139, 1))

lblDayDate.Text: Text(ThisItem.Date, "dd")
lblDayDate.Size: 20
lblDayDate.FontWeight: FontWeight.Bold

// Assignment gallery (inside each day cell)
galAssignments.Items =
    Filter(colMyRota, gc_assigned_date = ThisItem.Date);

galAssignments.TemplateSize: 80

// Assignment card (inside galAssignments template)
// Job name label
lblJobName.Text: LookUp(colJobs, gc_jobid = ThisItem.gc_job_id).gc_name
lblJobName.Size: 12
lblJobName.FontWeight: FontWeight.Bold

// Location label
lblLocation.Text: LookUp(colJobs, gc_jobid = ThisItem.gc_job_id).gc_location
lblLocation.Size: 10
lblLocation.Color: RGBA(100, 116, 139, 1)

// Status badge
lblStatus.Text: Switch(ThisItem.gc_status,
    "assigned", "Assigned",
    "started", "In Progress",
    "completed", "Done"
)
lblStatus.Fill: Switch(ThisItem.gc_status,
    "assigned", ColorValue("#E0F2FE"),
    "started", ColorValue("#FEF3C7"),
    "completed", ColorValue("#D1FAE5")
)
lblStatus.Color: Switch(ThisItem.gc_status,
    "assigned", ColorValue("#0C4A6E"),
    "started", ColorValue("#92400E"),
    "completed", ColorValue("#065F46")
)
lblStatus.Size: 9
lblStatus.FontWeight: FontWeight.Bold

// Start shift button
btnStartShift.OnSelect =
    'updateMyAssignment'.Run(
        ThisItem.gc_rotaassignmentid,
        JSON({status: "started", started_at: Text(Now())})
    );
    Navigate(ShiftWizardScreen, ScreenTransition.Fade, {varAssignmentId: ThisItem.gc_rotaassignmentid});

btnStartShift.Text: "Start"
btnStartShift.Size: 11
btnStartShift.Fill: ColorValue("#2E5A1A")
btnStartShift.Color: RGBA(255, 255, 255, 1)
btnStartShift.Visible: ThisItem.gc_status = "assigned"

// Acknowledge schedule button
btnAcknowledge.OnSelect =
    Patch(Staffs, varCurrentUser, {gc_last_acknowledged_week: varWeekStart, gc_schedule_acknowledged_at: Now()});
    Notify("Schedule acknowledged", NotificationType.Success);

btnAcknowledge.Text: "Acknowledge Week"
btnAcknowledge.Fill: ColorValue("#8DC63F")
btnAcknowledge.Color: ColorValue("#1c4a12")
\`\`\`

---

## Screen: ShiftWizardScreen (Daily workflow — checks, arrive, briefing, work, leave)

**Paste Target:** Create a screen named **ShiftWizardScreen**. Add groups **grpChecks**, **grpArrive**, **grpBriefing**, **grpWorking**, **grpLeave**, buttons **btnCompleteChecks**, **btnArriveOnSite**, **btnPowra**, **btnSignBriefing**, **btnLogActivity**, **btnLeaveSite**, signature control **sigBriefing**, labels **lblStep1**–**lblStep5**, **lblMittiVerified**, icon **icnMittiVerified**. Paste each block into the matching control property.

\`\`\`powerapps
ShiftWizardScreen.OnVisible =
    Set(varAssignment, LookUp(RotaAssignments, gc_rotaassignmentid = varAssignmentId));
    Set(varStep, 1); // 1=Checks, 2=Arrive, 3=Briefing, 4=Working, 5=Leave

// Step indicator bar
lblStep1.Fill: If(varStep >= 1, ColorValue("#2E5A1A"), ColorValue("#E2E8F0"))
lblStep2.Fill: If(varStep >= 2, ColorValue("#2E5A1A"), ColorValue("#E2E8F0"))
lblStep3.Fill: If(varStep >= 3, ColorValue("#2E5A1A"), ColorValue("#E2E8F0"))
lblStep4.Fill: If(varStep >= 4, ColorValue("#2E5A1A"), ColorValue("#E2E8F0"))
lblStep5.Fill: If(varStep >= 5, ColorValue("#2E5A1A"), ColorValue("#E2E8F0"))

// === Step 1: Daily Checks ===
grpChecks.Visible: varStep = 1

btnCompleteChecks.OnSelect =
    Patch(RotaAssignments, varAssignment,
        {gc_daily_checks_completed: true, gc_daily_checks_completed_at: Now()}
    );
    Set(varStep, 2);

btnCompleteChecks.Text: "Checks Complete"
btnCompleteChecks.Fill: ColorValue("#2E5A1A")
btnCompleteChecks.Size: 16

// Mitti verification badge (if Mitti is connected)
icnMittiVerified.Visible: !IsBlank(varAssignment.gc_mitti_vehicle_check_at)
lblMittiVerified.Text: "Vehicle check verified by Mitti"
lblMittiVerified.Color: ColorValue("#065F46")
lblMittiVerified.Visible: !IsBlank(varAssignment.gc_mitti_vehicle_check_at)

// === Step 2: Arrive on Site ===
grpArrive.Visible: varStep = 2

btnArriveOnSite.OnSelect =
    // Get current GPS location
    Set(varMyLocation, Location());
    
    // Stamp arrival
    Patch(RotaAssignments, varAssignment,
        {gc_arrived_on_site_at: Now(), gc_status: "started"}
    );
    
    // Log GPS to StaffLocationLog (gc_stafflocationlog table)
    Patch(StaffLocationLogs, Defaults(StaffLocationLogs),
        {gc_staff_id: varCurrentUser.gc_staffid,
         gc_lat: varMyLocation.Latitude,
         gc_lng: varMyLocation.Longitude,
         gc_accuracy_m: varMyLocation.Accuracy,
         gc_recorded_at: Now(),
         gc_assignment_id: varAssignment.gc_rotaassignmentid,
         gc_division_id: varCurrentUser.gc_division_id}
    );
    Set(varStep, 3);

btnArriveOnSite.Text: "I'm On Site"
btnArriveOnSite.Fill: ColorValue("#2E5A1A")
btnArriveOnSite.Size: 16

// POWRA link button (opens Mitti/SafetyCulture form)
btnPowra.OnSelect =
    Launch(varAssignment.gc_powra_url, {}, LaunchTarget.New);

btnPowra.Text: "Open POWRA"
btnPowra.Visible: !IsBlank(varAssignment.gc_powra_url)

// === Step 3: Briefing — signature capture ===
grpBriefing.Visible: varStep = 3

sigBriefing.OnSign =
    Set(varBriefingSignature, sigBriefing.Image);

btnSignBriefing.OnSelect =
    Patch(RotaAssignments, varAssignment,
        {gc_briefing_signed: true, gc_briefing_signed_at: Now()}
    );
    Set(varStep, 4);

btnSignBriefing.Text: "Sign Briefing"
btnSignBriefing.Fill: ColorValue("#2E5A1A")
btnSignBriefing.DisplayMode: If(!IsBlank(varBriefingSignature), DisplayMode.Edit, DisplayMode.Disabled)

// === Step 4: Working — log investigation activity ===
grpWorking.Visible: varStep = 4

btnLogActivity.OnSelect =
    Navigate(LogActivityScreen, ScreenTransition.Fade,
        {varJobId: varAssignment.gc_job_id, varAssignmentId: varAssignment.gc_rotaassignmentid}
    );

btnLogActivity.Text: "Log Activity"
btnLogActivity.Fill: ColorValue("#8DC63F")
btnLogActivity.Color: ColorValue("#1c4a12")

// === Step 5: Leave site ===
grpLeave.Visible: varStep = 5

btnLeaveSite.OnSelect =
    Set(varMyLocation, Location());
    Patch(RotaAssignments, varAssignment,
        {gc_left_site_at: Now()}
    );
    Navigate(EndOfShiftScreen, ScreenTransition.Fade);

btnLeaveSite.Text: "Leave Site"
btnLeaveSite.Fill: ColorValue("#2E5A1A")
\`\`\`

---

## Screen: LogActivityScreen (Investigation log entry)

\`\`\`powerapps
LogActivityScreen.OnVisible =
    Set(varLog, Defaults(InvestigationLogs));
    Set(varLog, Patch(varLog, {
        gc_job_id: varJobId,
        gc_staff_id: varCurrentUser.gc_staffid,
        gc_date: Today(),
        gc_log_type: "borehole_progress",
        gc_source: "staff"
    }));
    Clear(colPhotos);

// Borehole reference input
txtBoreholeRef.Default: varLog.gc_borehole_ref
txtBoreholeRef.OnChange: Set(varLog, Patch(varLog, {gc_borehole_ref: txtBoreholeRef.Text}))
txtBoreholeRef.Placeholder: "e.g. BH-01"

// Depth inputs
txtDepthFrom.Default: Text(varLog.gc_depth_from)
txtDepthFrom.OnChange: Set(varLog, Patch(varLog, {gc_depth_from: Value(txtDepthFrom.Text)}))
txtDepthFrom.Placeholder: "From (m)"

txtDepthTo.Default: Text(varLog.gc_depth_to)
txtDepthTo.OnChange: Set(varLog, Patch(varLog, {gc_depth_to: Value(txtDepthTo.Text)}))
txtDepthTo.Placeholder: "To (m)"

// Log type dropdown
cmbLogType.Items: ["borehole_progress", "sample_collection", "installation", "site_setup", "other"]
cmbLogType.Default: varLog.gc_log_type
cmbLogType.OnChange: Set(varLog, Patch(varLog, {gc_log_type: cmbLogType.Selected.Value}))

// Description
txtDescription.Default: varLog.gc_description
txtDescription.OnChange: Set(varLog, Patch(varLog, {gc_description: txtDescription.Text}))
txtDescription.Mode: TextMode.MultiLine
txtDescription.Placeholder: "Describe the work carried out..."

// Photo capture
btnTakePhoto.OnSelect =
    Set(varPhoto, Camera1.Photo);
    Collect(colPhotos, varPhoto);

btnTakePhoto.Text: "Take Photo"
btnTakePhoto.Icon: Icon.Camera

// Photo gallery
galPhotos.Items: colPhotos
galPhotos.TemplateSize: 80
imgPhoto.Image: ThisItem.Value
imgRemovePhoto.OnSelect: Remove(colPhotos, ThisItem)

// Save log
btnSaveLog.OnSelect =
    If(Connection.Connected,
        // Online — write directly to Dataverse
        Patch(InvestigationLogs, Defaults(InvestigationLogs), varLog);
        // Upload photos via flow
        ForAll(colPhotos,
            'uploadProfilePhoto'.Run(ThisItem)
        );
        Notify("Log saved", NotificationType.Success);
        Clear(colPhotos);
        Back();
    ,
        // Offline — store locally
        Collect(colOfflineLogs, varLog);
        Notify("Saved offline — will sync when connection returns", NotificationType.Info);
        Clear(colPhotos);
        Back();
    );

btnSaveLog.Text: "Save Log"
btnSaveLog.Fill: ColorValue("#2E5A1A")
btnSaveLog.Size: 16
\`\`\`

---

## Screen: ProfileScreen (Staff profile)

\`\`\`powerapps
ProfileScreen.OnVisible =
    Set(varStaff, varCurrentUser);

// Avatar image
imgAvatar.Image: varStaff.gc_avatar_url
imgAvatar.Width: 80
imgAvatar.Height: 80
imgAvatar.RadiusBottomLeft: 40
imgAvatar.RadiusBottomRight: 40
imgAvatar.RadiusTopLeft: 40
imgAvatar.RadiusTopRight: 40

// Staff name
lblStaffName.Text: varStaff.gc_name
lblStaffName.Size: 20
lblStaffName.FontWeight: FontWeight.Bold

// Job title
lblJobTitle.Text: varStaff.gc_job_title
lblJobTitle.Size: 14
lblJobTitle.Color: RGBA(100, 116, 139, 1)

// Edit profile button
btnEditProfile.OnSelect =
    Navigate(EditProfileScreen, ScreenTransition.Fade);

btnEditProfile.Text: "Edit Profile"
btnEditProfile.Fill: ColorValue("#2E5A1A")

// Tracking consent toggle
tglTracking.OnCheck =
    Patch(Staffs, varStaff, {gc_tracking_enabled: tglTracking.Value});
    If(tglTracking.Value,
        Notify("GPS tracking enabled during working hours", NotificationType.Success),
        Notify("GPS tracking disabled", NotificationType.Warning)
    );

tglTracking.Default: varStaff.gc_tracking_enabled

// Compliance wallet gallery
galCompliance.Items: Filter(ComplianceItems, gc_staff_id = varStaff.gc_staffid)
galCompliance.TemplateSize: 100

// Compliance card (inside galCompliance template)
lblCertName.Text: ThisItem.gc_certificate_title
lblCertName.Size: 12
lblCertName.FontWeight: FontWeight.Bold

lblExpiry.Text: "Expires: " & Text(ThisItem.gc_expiry_date, "dd/mm/yyyy")
lblExpiry.Size: 10
lblExpiry.Color: If(ThisItem.gc_expiry_date < DateAdd(Today(), 30, Days), ColorValue("#DC2626"), RGBA(100, 116, 139, 1))

lblStatus.Text: If(ThisItem.gc_expiry_date < Today(), "Expired", If(ThisItem.gc_expiry_date < DateAdd(Today(), 30, Days), "Expiring", "Valid"))
lblStatus.Fill: If(ThisItem.gc_expiry_date < Today(), ColorValue("#FEE2E2"), If(ThisItem.gc_expiry_date < DateAdd(Today(), 30, Days), ColorValue("#FEF3C7"), ColorValue("#D1FAE5")))
lblStatus.Color: If(ThisItem.gc_expiry_date < Today(), ColorValue("#991B1B"), If(ThisItem.gc_expiry_date < DateAdd(Today(), 30, Days), ColorValue("#92400E"), ColorValue("#065F46")))
lblStatus.Size: 9
lblStatus.FontWeight: FontWeight.Bold

// Email notification toggle
tglEmailNotif.OnCheck =
    Patch(Staffs, varStaff, {gc_email_notifications_enabled: tglEmailNotif.Value});

tglEmailNotif.Default: varStaff.gc_email_notifications_enabled
\`\`\`

---

## Screen: DeliveryDashboardScreen (Driver hub)

\`\`\`powerapps
DeliveryDashboardScreen.OnVisible =
    ClearCollect(colMyDeliveries,
        Filter(DeliveryLogs, gc_driver_staff_id = varCurrentUser.gc_staffid && gc_status = "pending")
    );

// Delivery gallery
galDeliveries.Items: colMyDeliveries
galDeliveries.TemplateSize: 120

// Delivery card (inside galDeliveries template)
lblDeliveryType.Text: Switch(ThisItem.gc_delivery_type,
    "site_delivery", "→ Site Delivery",
    "supplier_collection", "← Supplier Collection",
    "sample_collection", "🧪 Sample Collection",
    "item_handover", "📦 Item Handover"
)
lblDeliveryType.Size: 12
lblDeliveryType.FontWeight: FontWeight.Bold

lblDeliveryItems.Text: ThisItem.gc_items
lblDeliveryItems.Size: 10
lblDeliveryItems.Color: RGBA(100, 116, 139, 1)

lblDeliveryAddress.Text: ThisItem.gc_delivery_address
lblDeliveryAddress.Size: 10

lblScheduledDate.Text: "📅 " & Text(ThisItem.gc_scheduled_date, "dd MMM")
lblScheduledDate.Size: 10

// Start delivery button
btnStartDelivery.OnSelect =
    Patch(DeliveryLogs, ThisItem, {gc_status: "in_progress", gc_started_at: Now()});
    Navigate(DeliveryDetailScreen, ScreenTransition.Fade, {varDeliveryId: ThisItem.gc_deliverylogid});

btnStartDelivery.Text: "Start"
btnStartDelivery.Fill: ColorValue("#2E5A1A")
btnStartDelivery.Visible: ThisItem.gc_status = "pending"

// Complete delivery with signature
btnCompleteDelivery.OnSelect =
    // Capture signature and GPS
    Set(varSig, sigDelivery.Image);
    Set(varGps, Location());
    
    Patch(DeliveryLogs, varDelivery,
        {gc_status: "completed",
         gc_completed_at: Now(),
         gc_signature_data_url: varSig,
         gc_signed_by_name: txtSignedBy.Text,
         gc_gps_coordinates: Text(varGps.Latitude) & "," & Text(varGps.Longitude)}
    );
    
    // Check if samples need accounting
    If(varDelivery.gc_delivery_type = "sample_collection" || varDelivery.gc_delivery_type = "sample_delivery",
        If(chkSamplesAccounted.Value,
            Patch(DeliveryLogs, varDelivery, {gc_samples_accounted: true});
            Notify("Delivery completed", NotificationType.Success);
            Back();
        ,
            Notify("Please confirm all samples are accounted for", NotificationType.Error);
        )
    ,
        Notify("Delivery completed", NotificationType.Success);
        Back();
    );

btnCompleteDelivery.Text: "Complete Delivery"
btnCompleteDelivery.Fill: ColorValue("#2E5A1A")
btnCompleteDelivery.DisplayMode: If(!IsBlank(sigDelivery.Image) && !IsBlank(txtSignedBy.Text), DisplayMode.Edit, DisplayMode.Disabled)
\`\`\`

---

## Screen: ScannerScreen (Asset barcode scanner)

\`\`\`powerapps
ScannerScreen.OnVisible =
    ClearCollect(colScanBasket, []);

// Barcode scanner button
btnScan.OnSelect =
    // Opens device camera for barcode scan
    Set(varScanResult, ScanBarcode());
    
    // Resolve asset via Power Automate flow
    Set(varAsset, 'resolveAssetByQR'.Run(varScanResult));
    
    // Add to basket
    Collect(colScanBasket, {
        id: varAsset.gc_siteassetid,
        name: varAsset.gc_name,
        type: varAsset.gc_asset_type,
        scanCode: varScanResult
    });

btnScan.Text: "Scan Barcode"
btnScan.Icon: Icon.BarcodeScan
btnScan.Fill: ColorValue("#2E5A1A")
btnScan.Size: 16

// Scanned items gallery
galScanned.Items: colScanBasket
galScanned.TemplateSize: 60

// Scanned item card (inside galScanned template)
lblAssetName.Text: ThisItem.name
lblAssetName.Size: 12
lblAssetName.FontWeight: FontWeight.Bold

lblAssetType.Text: ThisItem.type
lblAssetType.Size: 10
lblAssetType.Color: RGBA(100, 116, 139, 1)

btnRemoveScan.OnSelect: Remove(colScanBasket, ThisItem)
btnRemoveScan.Icon: Icon.Cancel
btnRemoveScan.Color: ColorValue("#DC2626")

// Job selector dropdown
cmbJob.Items: colJobs
cmbJob.DisplayFields: ["gc_name"]
cmbJob.ValueFields: ["gc_jobid"]

// Sign out basket to a job
btnSignOut.OnSelect =
    'commitBasketSignOut'.Run(JSON(colScanBasket), cmbJob.Selected.gc_jobid);
    Clear(colScanBasket);
    Notify("Assets signed out to " & cmbJob.Selected.gc_name, NotificationType.Success);
    Back();

btnSignOut.Text: "Sign Out to Job"
btnSignOut.Fill: ColorValue("#2E5A1A")
btnSignOut.DisplayMode: If(CountRows(colScanBasket) > 0 && !IsBlank(cmbJob.Selected), DisplayMode.Edit, DisplayMode.Disabled)
\`\`\`

---

## Screen: RotaBuilderScreen (Admin — drag-and-drop rota grid)

\`\`\`powerapps
RotaBuilderScreen.OnVisible =
    ClearCollect(colStaff, Filter(Staffs, gc_is_active = true));
    ClearCollect(colJobs, Filter(Jobs, gc_status = "in_progress" || gc_status = "planning"));
    ClearCollect(colRotas, Filter(RotaAssignments, gc_week_start = varSelectedWeek));
    Set(varSelectedWeek, Today() - Weekday(Today(), StartOfWeek.Monday) + 1);

// Staff gallery (left column)
galStaff.Items: colStaff
galStaff.TemplateSize: 50

// Staff card (inside galStaff template)
lblStaffName.Text: ThisItem.gc_name
lblStaffName.Size: 11
lblStaffName.FontWeight: FontWeight.Bold

lblStaffRole.Text: ThisItem.gc_job_title
lblStaffRole.Size: 9
lblStaffRole.Color: RGBA(100, 116, 139, 1)

// Day header gallery (top row)
galDays.Items:
    Table(
        {Day: "Mon", Date: varSelectedWeek, Index: 0},
        {Day: "Tue", Date: DateAdd(varSelectedWeek, 1, Days), Index: 1},
        {Day: "Wed", Date: DateAdd(varSelectedWeek, 2, Days), Index: 2},
        {Day: "Thu", Date: DateAdd(varSelectedWeek, 3, Days), Index: 3},
        {Day: "Fri", Date: DateAdd(varSelectedWeek, 4, Days), Index: 4}
    );

// Assignment cards in each day cell
galCellAssignments.Items:
    Filter(colRotas,
        gc_staff_id = galStaff.Selected.gc_staffid &&
        gc_assigned_date = ThisItem.Date
    );

galCellAssignments.TemplateSize: 40

// Assignment card (inside galCellAssignments template)
lblAssignmentJob.Text: LookUp(colJobs, gc_jobid = ThisItem.gc_job_id).gc_name
lblAssignmentJob.Size: 9
lblAssignmentJob.FontWeight: FontWeight.Bold

lblAssignmentStatus.Text: Switch(ThisItem.gc_status, "assigned", "A", "started", "S", "completed", "D")
lblAssignmentStatus.Fill: Switch(ThisItem.gc_status, "assigned", ColorValue("#E0F2FE"), "started", ColorValue("#FEF3C7"), "completed", ColorValue("#D1FAE5"))

// Click empty cell to add assignment
btnAddAssignment.OnSelect =
    Navigate(AssignmentModalScreen, ScreenTransition.Fade,
        {varStaffId: galStaff.Selected.gc_staffid, varDate: ThisItem.Date}
    );

btnAddAssignment.Visible: CountRows(galCellAssignments.AllItems) = 0
btnAddAssignment.Text: "+"
btnAddAssignment.Size: 16
btnAddAssignment.Color: RGBA(100, 116, 139, 1)

// Publish week button
btnPublishWeek.OnSelect =
    'publishRotaWeek'.Run(Text(varSelectedWeek, "yyyy-mm-dd"), false);
    Notify("Rota published — staff emailed", NotificationType.Success);

btnPublishWeek.Text: "Publish Week"
btnPublishWeek.Fill: ColorValue("#2E5A1A")
btnPublishWeek.Size: 14

// Smart-fill (copy last week)
btnSmartFill.OnSelect =
    Set(varLastWeek, DateAdd(varSelectedWeek, -7, Days));
    ClearCollect(colLastWeekRotas, Filter(RotaAssignments, gc_week_start = varLastWeek));
    ForAll(colLastWeekRotas,
        Patch(RotaAssignments, Defaults(RotaAssignments),
            {gc_staff_id: ThisItem.gc_staff_id,
             gc_job_id: ThisItem.gc_job_id,
             gc_assigned_date: DateAdd(ThisItem.gc_assigned_date, 7, Days),
             gc_week_start: varSelectedWeek,
             gc_assignment_type: ThisItem.gc_assignment_type,
             gc_status: "assigned"}
        )
    );
    ClearCollect(colRotas, Filter(RotaAssignments, gc_week_start = varSelectedWeek));
    Notify("Copied from last week", NotificationType.Success);

btnSmartFill.Text: "Copy Last Week"
btnSmartFill.Fill: ColorValue("#8DC63F")
btnSmartFill.Color: ColorValue("#1c4a12")
\`\`\`

---

## Screen: AFPBuilderScreen (Admin — AFP billing builder)

\`\`\`powerapps
AFPBuilderScreen.OnVisible =
    ClearCollect(colAFP, Filter(AFPs, gc_job_id = varJobId));
    Set(varAFPId, First(colAFP).gc_afpid);
    ClearCollect(colLineItems, Filter(AFPLineItems, gc_afp_id = varAFPId));

// AFP header
lblAFPPeriod.Text: Text(First(colAFP).gc_period_start, "dd MMM") & " — " & Text(First(colAFP).gc_period_end, "dd MMM yyyy")
lblAFPPeriod.Size: 16
lblAFPPeriod.FontWeight: FontWeight.Bold

// Sheet tabs
tabMeasuredWorks.OnSelect:
    ClearCollect(colLineItems, Filter(AFPLineItems, gc_afp_id = varAFPId, gc_sheet_name = "measured_works"));
tabMeasuredWorks.Text: "Measured Works"
tabMeasuredWorks.Fill: If(activeTab = "measured_works", ColorValue("#2E5A1A"), ColorValue("#E2E8F0"))
tabMeasuredWorks.Color: If(activeTab = "measured_works", RGBA(255,255,255,1), RGBA(30,41,59,1))

tabVariations.OnSelect:
    ClearCollect(colLineItems, Filter(AFPLineItems, gc_afp_id = varAFPId, gc_sheet_name = "variations"));
    Set(activeTab, "variations");
tabVariations.Text: "Variations"

tabEWRDrilling.OnSelect:
    ClearCollect(colLineItems, Filter(AFPLineItems, gc_afp_id = varAFPId, gc_sheet_name = "ewr_rotary_drilling"));
    Set(activeTab, "ewr_rotary_drilling");
tabEWRDrilling.Text: "EWR Drilling"

// Line items gallery
galLineItems.Items: colLineItems
galLineItems.TemplateSize: 50

// Line item row (inside galLineItems template)
lblItemRef.Text: ThisItem.gc_item_ref
lblItemRef.Size: 10
lblItemRef.FontWeight: FontWeight.Bold

lblItemDesc.Text: ThisItem.gc_item
lblItemDesc.Size: 10

lblQty.Text: Text(ThisItem.gc_qty, "#,##0.00")
lblQty.Size: 10
lblQty.Align: Alignment.Right

lblRate.Text: "£" & Text(ThisItem.gc_rate, "#,##0.00")
lblRate.Size: 10
lblRate.Align: Alignment.Right

lblAmount.Text: "£" & Text(ThisItem.gc_applied_in_period, "#,##0.00")
lblAmount.Size: 10
lblAmount.FontWeight: FontWeight.Bold
lblAmount.Align: Alignment.Right

// Dispute status badge
lblDisputeStatus.Text: Switch(ThisItem.gc_dispute_status,
    "none", "",
    "disputed", "Disputed",
    "counter_offered", "Counter",
    "agreed", "Agreed",
    "rejected", "Rejected"
)
lblDisputeStatus.Visible: ThisItem.gc_dispute_status <> "none"
lblDisputeStatus.Fill: Switch(ThisItem.gc_dispute_status,
    "disputed", ColorValue("#FEE2E2"),
    "counter_offered", ColorValue("#FEF3C7"),
    "agreed", ColorValue("#D1FAE5"),
    "rejected", ColorValue("#F1F5F9")
)

// Total claimed
lblTotalClaimed.Text: "£" & Text(Sum(colLineItems, gc_applied_in_period), "#,##0.00")
lblTotalClaimed.Size: 18
lblTotalClaimed.FontWeight: FontWeight.Bold
lblTotalClaimed.Color: ColorValue("#2E5A1A")

// Submit AFP to client
btnSubmitAFP.OnSelect:
    'submitAFPToClient'.Run(varAFPId);
    Notify("AFP submitted to client", NotificationType.Success);

btnSubmitAFP.Text: "Submit to Client"
btnSubmitAFP.Fill: ColorValue("#2E5A1A")

// Refresh from field data
btnRefreshFromField.OnSelect:
    'populateAFPFromFieldData'.Run(varAFPId);
    ClearCollect(colLineItems, Filter(AFPLineItems, gc_afp_id = varAFPId));
    Notify("AFP refreshed from field data", NotificationType.Success);

btnRefreshFromField.Text: "Refresh from Field"
btnRefreshFromField.Fill: ColorValue("#8DC63F")
btnRefreshFromField.Color: ColorValue("#1c4a12")
\`\`\`

---

## Screen: AdminDashboardScreen (Command centre)

\`\`\`powerapps
AdminDashboardScreen.OnVisible =
    ClearCollect(colActiveJobs, Filter(Jobs, gc_status = "in_progress"));
    ClearCollect(colTodayRotas, Filter(RotaAssignments, gc_assigned_date = Today()));
    ClearCollect(colAlerts, []);

// KPI tiles
lblActiveJobs.Text: CountRows(colActiveJobs)
lblActiveJobs.Size: 28
lblActiveJobs.FontWeight: FontWeight.Bold
lblActiveJobs.Color: ColorValue("#2E5A1A")

lblCrewOnSite.Text: CountRows(Distinct(colTodayRotas, gc_staff_id))
lblCrewOnSite.Size: 28
lblCrewOnSite.FontWeight: FontWeight.Bold

lblShiftsToday.Text: CountRows(colTodayRotas)
lblShiftsToday.Size: 28
lblShiftsToday.FontWeight: FontWeight.Bold

// Active jobs gallery
galActiveJobs.Items: colActiveJobs
galActiveJobs.TemplateSize: 80

// Job card (inside galActiveJobs template)
lblJobName.Text: ThisItem.gc_name
lblJobName.Size: 12
lblJobName.FontWeight: FontWeight.Bold

lblJobLocation.Text: ThisItem.gc_location
lblJobLocation.Size: 10
lblJobLocation.Color: RGBA(100, 116, 139, 1)

lblJobStatus.Text: Switch(ThisItem.gc_status,
    "planning", "Planning",
    "in_progress", "Active",
    "decommissioning", "Decommissioning",
    "completed", "Completed"
)
lblJobStatus.Fill: Switch(ThisItem.gc_status,
    "planning", ColorValue("#E0F2FE"),
    "in_progress", ColorValue("#D1FAE5"),
    "decommissioning", ColorValue("#FEF3C7"),
    "completed", ColorValue("#F1F5F9")
)

// Crew count badge
lblCrewCount.Text: CountRows(Filter(colTodayRotas, gc_job_id = ThisItem.gc_jobid)) & " crew"
lblCrewCount.Size: 10
lblCrewCount.Color: ColorValue("#2E5A1A")

// Refresh data
btnRefresh.OnSelect:
    ClearCollect(colActiveJobs, Filter(Jobs, gc_status = "in_progress"));
    ClearCollect(colTodayRotas, Filter(RotaAssignments, gc_assigned_date = Today()));

btnRefresh.Text: ""
btnRefresh.Icon: Icon.Refresh

// Auto-refresh every 5 minutes
timerRefresh.Duration: 300000
timerRefresh.OnTimerEnd: btnRefresh.OnSelect
timerRefresh.Repeat: true
timerRefresh.Start: true
timerRefresh.Visible: false
\`\`\`

---

## Offline Sync Pattern

\`\`\`powerapps
// On any data write, check connection first
// If offline, store in a local collection and sync later

// Generic save pattern (use in every save button)
btnSaveLog.OnSelect =
    If(Connection.Connected,
        // Online — write directly to Dataverse
        Patch(InvestigationLogs, Defaults(InvestigationLogs), varLog);
        Notify("Saved", NotificationType.Success);
    ,
        // Offline — store locally
        Collect(colOfflineLogs, varLog);
        Notify("Saved offline — will sync when connection returns", NotificationType.Info);
    );

// Connection change handler — sync all offline collections
App.ConnectionChange =
    If(Connection.Connected,
        // Sync offline logs
        If(CountRows(colOfflineLogs) > 0,
            ForAll(colOfflineLogs,
                Patch(InvestigationLogs, Defaults(InvestigationLogs), ThisItem)
            );
            Clear(colOfflineLogs);
            Notify("Offline logs synced", NotificationType.Success);
        );
        // Sync offline photos
        If(CountRows(colOfflinePhotos) > 0,
            ForAll(colOfflinePhotos,
                'uploadProfilePhoto'.Run(ThisItem)
            );
            Clear(colOfflinePhotos);
        );
    );
\`\`\`

---

## Build Instructions

1. **Create the canvas app** in Power Apps Studio (Phone layout).
2. **Connect data sources:**
   - Dataverse (all tables from Volume 1)
   - Office 365 Users (for user info)
   - Office 365 Outlook (for emails)
3. **Create the screens** listed above in this order:
   - LoginScreen
   - PendingAccessScreen
   - ScheduleScreen
   - ShiftWizardScreen
   - LogActivityScreen
   - ProfileScreen
   - EditProfileScreen
   - DeliveryDashboardScreen
   - DeliveryDetailScreen
   - ScannerScreen
   - RotaBuilderScreen
   - AssignmentModalScreen
   - AFPBuilderScreen
   - AdminDashboardScreen
   - EndOfShiftScreen
4. **Paste the Power Fx** into each control's properties as listed.
5. **Add the Power Automate flows** (from Volume 2) as data sources — each flow reference (e.g. \`'publishRotaWeek'.Run(...)\`) requires the corresponding flow to be added.
6. **Set the App.OnStart** to load the current user and navigate to the landing page.
7. **Configure the offline profile** in Power Apps Studio (File → Settings → Advanced → Offline data) — select the tables to cache offline (Staff, RotaAssignment, Job, InvestigationLog).
8. **Test on mobile** using the Power Apps mobile app (iOS and Android).
9. **Publish** the app and share it with the Field Crew security group.
`;
}