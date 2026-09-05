// Generates Power Fx source code for the canvas app screens.
// Covers the field-crew mobile app and the complex builders.

export function generatePowerFxDocument() {
  return `# GC Mission Control — Canvas App Power Fx Source Pack

**Volume 3 of 5 — Canvas App Build Manual**

This document contains the Power Fx source for every screen in the canvas app.
Copy each section into the corresponding screen in Power Apps Studio.

---

## App (App object — global variables and startup)

\`\`\`powerapps
App.OnStart =
    // Load current user from Dataverse
    Set(varCurrentUser, LookUp(Staffs, Email = User().Email));
    
    // Determine landing page based on permission group
    If(!IsBlank(varCurrentUser),
        Set(varLandingPage,
            Switch(varCurrentUser.PermissionGroup.Name,
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
    
    // Connection status
    Set(varIsOnline, Connection.Connected);
\`\`\`

---

## Screen: LoginScreen

\`\`\`powerapps
LoginScreen.OnVisible =
    // Redirect to Microsoft Entra ID SSO
    Launch("https://login.microsoftonline.com/common/oauth2/v2.0/authorize?..." & 
           "&client_id=" & varClientId & 
           "&redirect_uri=" & varRedirectUri & 
           "&response_type=code&scope=openid+profile+email");

btnMicrosoftSignIn.OnSelect =
    Launch("https://login.microsoftonline.com/common/oauth2/v2.0/authorize?" &
           "client_id=" & varClientId &
           "&response_type=code" &
           "&redirect_uri=" & varRedirectUri &
           "&scope=openid+profile+email+offline_access" &
           "&prompt=select_account");
\`\`\`

---

## Screen: ScheduleScreen (Field crew weekly schedule)

\`\`\`powerapps
ScheduleScreen.OnVisible =
    // Load this week's assignments for the current user
    ClearCollect(colMyRota,
        Filter(RotaAssignments,
            staff_id.Value = varCurrentUser.gc_staffid &&
            week_start = varWeekStart
        )
    );
    
    // Load jobs for display
    ClearCollect(colJobs, Jobs);

// Week navigation
btnPrevWeek.OnSelect =
    Set(varWeekStart, DateAdd(varWeekStart, -7, Days));
    ClearCollect(colMyRota,
        Filter(RotaAssignments,
            staff_id.Value = varCurrentUser.gc_staffid &&
            week_start = varWeekStart
        )
    );

btnNextWeek.OnSelect =
    Set(varWeekStart, DateAdd(varWeekStart, 7, Days));
    ClearCollect(colMyRota,
        Filter(RotaAssignments,
            staff_id.Value = varCurrentUser.gc_staffid &&
            week_start = varWeekStart
        )
    );

// Day gallery — shows Monday to Friday
galDays.Items =
    Table(
        {Day: "Mon", Date: varWeekStart},
        {Day: "Tue", Date: DateAdd(varWeekStart, 1, Days)},
        {Day: "Wed", Date: DateAdd(varWeekStart, 2, Days)},
        {Day: "Thu", Date: DateAdd(varWeekStart, 3, Days)},
        {Day: "Fri", DateAdd(varWeekStart, 4, Days)}
    );

// Assignment card within each day
galAssignments.Items =
    Filter(colMyRota, assigned_date = ThisItem.Date);

// Job name label
lblJobName.Text =
    LookUp(colJobs, gc_jobid = ThisItem.job_id.Value).name;

// Status badge
lblStatus.Text =
    Switch(ThisItem.status,
        "assigned", "Assigned",
        "started", "In Progress",
        "completed", "Done"
    );

// Start shift button
btnStartShift.OnSelect =
    // Call the updateMyAssignment flow
    'updateMyAssignment'.Run(
        ThisItem.gc_rotaassignmentid,
        JSON({status: "started", started_at: Now()})
    );
    Navigate(ShiftWizardScreen, ScreenTransition.Fade, {varAssignmentId: ThisItem.gc_rotaassignmentid});

// Acknowledge schedule
btnAcknowledge.OnSelect =
    Patch(Staffs, varCurrentUser, {last_acknowledged_week: varWeekStart, schedule_acknowledged_at: Now()});
    Notify("Schedule acknowledged", NotificationType.Success);
\`\`\`

---

## Screen: ShiftWizardScreen (Daily workflow — checks, arrive, briefing, work, leave)

\`\`\`powerapps
ShiftWizardScreen.OnVisible =
    Set(varAssignment, LookUp(RotaAssignments, gc_rotaassignmentid = varAssignmentId));
    Set(varStep, 1); // 1=Checks, 2=Arrive, 3=Briefing, 4=Working, 5=Leave

// Step 1: Daily Checks
btnCompleteChecks.OnSelect =
    Patch(RotaAssignments, varAssignment,
        {daily_checks_completed: true, daily_checks_completed_at: Now()}
    );
    Set(varStep, 2);

// Step 2: Arrive on Site — capture GPS
btnArriveOnSite.OnSelect =
    // Get current GPS location
    Set(varMyLocation, Location());
    
    // Stamp arrival
    Patch(RotaAssignments, varAssignment,
        {arrived_on_site_at: Now(), status: "started"}
    );
    
    // Log GPS to StaffLocationLog
    Patch(StaffLocationLogs, Defaults(StaffLocationLogs),
        {staff_id: varCurrentUser.gc_staffid,
         lat: varMyLocation.Latitude,
         lng: varMyLocation.Longitude,
         recorded_at: Now(),
         assignment_id: varAssignment.gc_rotaassignmentid}
    );
    Set(varStep, 3);

// Step 3: Briefing — signature capture
sigBriefing.OnSign =
    Set(varBriefingSignature, sigBriefing.Image);

btnSignBriefing.OnSelect =
    Patch(RotaAssignments, varAssignment,
        {briefing_signed: true, briefing_signed_at: Now()}
    );
    Set(varStep, 4);

// Step 4: Working — log investigation activity
btnLogActivity.OnSelect =
    Navigate(LogActivityScreen, ScreenTransition.Fade,
        {varJobId: varAssignment.job_id.Value, varAssignmentId: varAssignment.gc_rotaassignmentid}
    );

// Step 5: Leave site
btnLeaveSite.OnSelect =
    Set(varMyLocation, Location());
    Patch(RotaAssignments, varAssignment,
        {left_site_at: Now()}
    );
    Navigate(EndOfShiftScreen, ScreenTransition.Fade);
\`\`\`

---

## Screen: LogActivityScreen (Investigation log entry)

\`\`\`powerapps
LogActivityScreen.OnVisible =
    Set(varLog, Defaults(InvestigationLogs));
    Set(varLog, Patch(varLog, {
        job_id: varJobId,
        staff_id: varCurrentUser.gc_staffid,
        date: Today(),
        log_type: "borehole_progress"
    }));

// Borehole reference input
txtBoreholeRef.Default = varLog.borehole_ref;
txtBoreholeRef.OnChange = Set(varLog, Patch(varLog, {borehole_ref: txtBoreholeRef.Text}));

// Depth inputs
txtDepthFrom.Default = Text(varLog.depth_from);
txtDepthFrom.OnChange = Set(varLog, Patch(varLog, {depth_from: Value(txtDepthFrom.Text)}));

txtDepthTo.Default = Text(varLog.depth_to);
txtDepthTo.OnChange = Set(varLog, Patch(varLog, {depth_to: Value(txtDepthTo.Text)}));

// Description
txtDescription.Default = varLog.description;
txtDescription.OnChange = Set(varLog, Patch(varLog, {description: txtDescription.Text}));

// Photo capture
btnTakePhoto.OnSelect =
    Set(varPhoto, Camera1.Photo);
    Collect(colPhotos, varPhoto);

// Save log
btnSaveLog.OnSelect =
    // Upload photos first
    ForAll(colPhotos,
        'uploadProfilePhoto'.Run(ThisRecord) // reuse file upload flow
    );
    
    // Create the log record
    Patch(InvestigationLogs, Defaults(InvestigationLogs), varLog);
    
    // Clear and go back
    Clear(colPhotos);
    Back();
\`\`\`

---

## Screen: ProfileScreen (Staff profile)

\`\`\`powerapps
ProfileScreen.OnVisible =
    Set(varStaff, varCurrentUser);

// Avatar
imgAvatar.Image = varStaff.avatar_url;

// Edit profile
btnEditProfile.OnSelect =
    Navigate(EditProfileScreen, ScreenTransition.Fade);

// Tracking consent toggle
tglTracking.OnCheck =
    Patch(Staffs, varStaff, {tracking_enabled: tglTracking.Value});
    If(tglTracking.Value,
        Notify("GPS tracking enabled during working hours", NotificationType.Success),
        Notify("GPS tracking disabled", NotificationType.Warning)
    );

// Compliance wallet
galCompliance.Items =
    Filter(ComplianceItems, staff_id.Value = varStaff.gc_staffid);
    
galCompliance.Template =
    // Card showing certificate name, issue date, expiry date, status badge
    lblCertName.Text = ThisItem.certificate_title;
    lblExpiry.Text = "Expires: " & Text(ThisItem.expiry_date, "dd/mm/yyyy");
    lblStatus.Text = If(ThisItem.expiry_date < DateAdd(Today(), 30, Days), "Expiring", "Valid");
\`\`\`

---

## Screen: DeliveryDashboardScreen (Driver hub)

\`\`\`powerapps
DeliveryDashboardScreen.OnVisible =
    ClearCollect(colMyDeliveries,
        Filter(DeliveryLogs, driver_staff_id.Value = varCurrentUser.gc_staffid && status = "pending")
    );

// Delivery card
galDeliveries.Items = colMyDeliveries;

// Start delivery
btnStartDelivery.OnSelect =
    Patch(DeliveryLogs, ThisItem, {status: "in_progress", started_at: Now()});
    Navigate(DeliveryDetailScreen, ScreenTransition.Fade, {varDeliveryId: ThisItem.gc_deliverylogid});

// Complete delivery with signature
btnCompleteDelivery.OnSelect =
    // Capture signature
    Set(varSig, sigDelivery.Image);
    Set(varGps, Location());
    
    Patch(DeliveryLogs, varDelivery,
        {status: "completed",
         completed_at: Now(),
         signature_data_url: varSig,
         signed_by_name: txtSignedBy.Text,
         gps_coordinates: Text(varGps.Latitude) & "," & Text(varGps.Longitude)}
    );
    
    // Check if samples need accounting
    If(varDelivery.delivery_type = "sample_collection" || varDelivery.delivery_type = "sample_delivery",
        If(chkSamplesAccounted.Value,
            Patch(DeliveryLogs, varDelivery, {samples_accounted: true});
            Back();
        ,
            Notify("Please confirm all samples are accounted for", NotificationType.Error);
        )
    ,
        Back();
    );
\`\`\`

---

## Screen: ScannerScreen (Asset barcode scanner)

\`\`\`powerapps
ScannerScreen.OnVisible =
    ClearCollect(colScanBasket, []);

// Barcode scanner
btnScan.OnSelect =
    // Opens device camera for barcode
    Set(varScanResult, ScanBarcode());
    
    // Resolve asset
    Set(varAsset, 'resolveAssetByQR'.Run(varScanResult));
    
    // Add to basket
    Collect(colScanBasket, varAsset);

// Scanned items gallery
galScanned.Items = colScanBasket;

// Sign out basket to a job
btnSignOut.OnSelect =
    'commitBasketSignOut'.Run(JSON(colScanBasket), cmbJob.Selected.gc_jobid);
    Clear(colScanBasket);
    Notify("Assets signed out", NotificationType.Success);
    Back();
\`\`\`

---

## Screen: RotaBuilderScreen (Admin — drag-and-drop rota grid)

\`\`\`powerapps
RotaBuilderScreen.OnVisible =
    ClearCollect(colStaff, Filter(Staffs, is_active = true));
    ClearCollect(colJobs, Jobs);
    ClearCollect(colRotas,
        Filter(RotaAssignments, week_start = varWeekStart)
    );
    Set(varSelectedWeek, Today() - Weekday(Today(), StartOfWeek.Monday) + 1);

// Staff gallery (left column)
galStaff.Items = colStaff;

// Day header gallery
galDays.Items =
    Table(
        {Day: "Mon", Date: varSelectedWeek, Index: 0},
        {Day: "Tue", Date: DateAdd(varSelectedWeek, 1, Days), Index: 1},
        {Day: "Wed", Date: DateAdd(varSelectedWeek, 2, Days), Index: 2},
        {Day: "Thu", Date: DateAdd(varSelectedWeek, 3, Days), Index: 3},
        {Day: "Fri", Date: DateAdd(varSelectedWeek, 4, Days), Index: 4}
    );

// Assignment cards in each day cell
galCellAssignments.Items =
    Filter(colRotas,
        staff_id.Value = galStaff.Selected.gc_staffid &&
        assigned_date = ThisItem.Date
    );

// Click empty cell to add assignment
btnAddAssignment.OnSelect =
    Navigate(AssignmentModalScreen, ScreenTransition.Fade,
        {varStaffId: galStaff.Selected.gc_staffid, varDate: ThisItem.Date}
    );

// Publish week
btnPublishWeek.OnSelect =
    'publishRotaWeek'.Run(Text(varSelectedWeek, "yyyy-mm-dd"), false);
    Notify("Rota published — staff emailed", NotificationType.Success);
\`\`\`

---

## Screen: AFPBuilderScreen (Admin — AFP billing builder)

\`\`\`powerapps
AFPBuilderScreen.OnVisible =
    ClearCollect(colAFP, Filter(AFPs, job_id.Value = varJobId));
    ClearCollect(colLineItems, Filter(AFPLineItems, afp_id.Value = colAFP[0].gc_afpid));

// Line items gallery
galLineItems.Items = colLineItems;

// Sheet tabs
tabMeasuredWorks.OnSelect =
    ClearCollect(colLineItems, Filter(AFPLineItems, afp_id.Value = varAFPId, sheet_name = "measured_works"));
tabVariations.OnSelect =
    ClearCollect(colLineItems, Filter(AFPLineItems, afp_id.Value = varAFPId, sheet_name = "variations"));
tabMaterials.OnSelect =
    ClearCollect(colLineItems, Filter(AFPLineItems, afp_id.Value = varAFPId, sheet_name = "materials"));

// Total claimed
lblTotalClaimed.Text = "£" & Text(Sum(colLineItems, applied_in_period), "#,##0.00");

// Submit AFP to client
btnSubmitAFP.OnSelect =
    'submitAFPToClient'.Run(varAFPId);
    Notify("AFP submitted to client", NotificationType.Success);
\`\`\`

---

## Screen: AdminDashboardScreen (Command centre)

\`\`\`powerapps
AdminDashboardScreen.OnVisible =
    ClearCollect(colActiveJobs, Filter(Jobs, status = "in_progress"));
    ClearCollect(colTodayRotas, Filter(RotaAssignments, assigned_date = Today()));
    ClearCollect(colAlerts, []);

// KPI tiles
lblActiveJobs.Text = CountRows(colActiveJobs);
lblCrewOnSite.Text = CountRows(Distinct(colTodayRotas, staff_id.Value));
lblShiftsToday.Text = CountRows(colTodayRotas);

// Refresh data
btnRefresh.OnSelect =
    ClearCollect(colActiveJobs, Filter(Jobs, status = "in_progress"));
    ClearCollect(colTodayRotas, Filter(RotaAssignments, assigned_date = Today()));

// Auto-refresh every 5 minutes
Timer1.Duration = 300000;
Timer1.OnTimerEnd = btnRefresh.OnSelect;
Timer1.Repeat = true;
Timer1.Start = true;
\`\`\`

---

## Offline Sync Pattern

\`\`\`powerapps
// On any data write, check connection first
// If offline, store in a local collection and sync later

btnSaveLog.OnSelect =
    If(Connection.Connected,
        // Online — write directly to Dataverse
        Patch(InvestigationLogs, Defaults(InvestigationLogs), varLog);
    ,
        // Offline — store locally
        Collect(colOfflineLogs, varLog);
        Notify("Saved offline — will sync when connection returns", NotificationType.Info);
    );

// Connection change handler
App.ConnectionChange =
    If(Connection.Connected && CountRows(colOfflineLogs) > 0,
        // Sync offline logs
        ForAll(colOfflineLogs,
            Patch(InvestigationLogs, Defaults(InvestigationLogs), ThisItem)
        );
        Clear(colOfflineLogs);
        Notify("Offline data synced", NotificationType.Success);
    );
\`\`\`

---

## Build Instructions

1. Create a new canvas app in Power Apps Studio (Phone layout).
2. Connect to the Dataverse solution (all tables from Volume 1).
3. Add the Office 365 Users, Office 365 Outlook connectors.
4. Create each screen listed above and paste the Power Fx into the corresponding properties.
5. Set up the App.OnStart to load the current user and navigate to the landing page.
6. For each flow reference (e.g. \`'publishRotaWeek'.Run(...)\`), add the corresponding Power Automate flow from Volume 2 as a data source.
7. Test on mobile using the Power Apps mobile app.
`;
}