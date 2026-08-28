import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const assignmentId = body.event?.entity_id || body.assignment_id;

    if (!assignmentId) {
      return Response.json({ error: 'Missing assignment_id' }, { status: 400 });
    }

    // Always require an authenticated user — never trust a client-supplied
    // `event` flag to determine the call origin (it can be forged).
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch the current assignment to check status
    const assignment = await base44.asServiceRole.entities.RotaAssignment.get(assignmentId);
    if (!assignment) {
      return Response.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Reset briefing fields and shift confirmation (assignment context changed)
    const resetData = {
      briefing_signed: false,
      briefing_signed_at: null,
      briefing_start_at: null,
      shift_status: 'pending'
    };

    // If the job was started via briefing, reset status so staff re-brief and re-start
    if (assignment.status === 'started') {
      resetData.status = 'assigned';
      resetData.started_at = null;
    }

    await base44.asServiceRole.entities.RotaAssignment.update(assignmentId, resetData);

    return Response.json({ success: true, assignment_id: assignmentId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});