import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { escapeHtml, linkBlock, styledHtml, getAppBaseUrl } from '../../shared/emailStyling.ts';
import { createApproval } from '../../shared/inboxEngine.ts';

const TYPE_LABELS = {
  cscs_card: 'CSCS Card',
  cpcs_card: 'CPCS Card',
  npors_card: 'NPORS Card',
  first_aid_cert: 'First Aid Certificate',
  driver_license: 'Driver License',
  dbs_certificate: 'DBS Certificate',
  forklift: 'Forklift Training',
  other: 'Training',
};

function defaultDate(daysAhead = 14) {
  const d = new Date(Date.now() + daysAhead * 86400000);
  return d.toISOString().split('T')[0];
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { staff_id, staff_name, request_text, qualification_type, preferred_date } = body;
    if (!staff_id || !staff_name) {
      return Response.json({ error: 'staff_id and staff_name are required' }, { status: 400 });
    }

    const docType = TYPE_LABELS[qualification_type] || 'training';

    const todayStr = new Date().toISOString().split('T')[0];
    const prompt = `A UK construction field worker named "${staff_name}" is requesting training via their self-service portal.
Today's date is ${todayStr}.
Request: "${request_text || `Renewal for ${docType}`}"
${preferred_date ? `Preferred date: ${preferred_date}` : 'No specific date — suggest one 2-4 weeks from now.'}

Suggest a practical UK training course. Return:
- title: A clear course title (e.g. "CSCS Skilled Worker Card Renewal", "First Aid at Work (3 Day)", "NPORS Plant Operator")
- category: One of: cscs_card, cpcs_card, npors_card, first_aid_cert, driver_license, dbs_certificate, forklift, other
- provider: A real UK training provider name (e.g. "CITB", "St John Ambulance", "3B Training", "SSSTS Course Provider")
- suggested_date: A date in YYYY-MM-DD format (2-4 weeks from now, ideally a weekday)

Keep it realistic for the UK construction industry.`;

    const schema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        category: { type: 'string' },
        provider: { type: 'string' },
        suggested_date: { type: 'string' },
      },
    };

    const suggestion = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: schema,
    });

    const startDate = suggestion.suggested_date || preferred_date || defaultDate();

    // Create the training course
    const course = await base44.entities.TrainingCourse.create({
      title: suggestion.title || `${docType} Renewal`,
      category: suggestion.category || qualification_type || 'other',
      provider: suggestion.provider || '',
      start_date: startDate,
      end_date: startDate,
      start_time: '08:00',
      end_time: '16:00',
      status: 'scheduled',
      description: `Requested by ${staff_name} via self-service portal. ${request_text || ''}`.trim(),
    });

    // Create the booking for the staff member
    const booking = await base44.entities.TrainingBooking.create({
      course_id: course.id,
      staff_id,
      staff_name,
      status: 'booked',
    });

    // Create inbox approval for the manager to approve/decline the training request
    try {
      await createApproval(base44, {
        approvalType: 'training_request',
        requesterStaffId: staff_id,
        title: `Training request — ${staff_name}: ${course.title || docType}`,
        body: `${staff_name} requested training: ${course.title || docType}.${course.provider ? ' Provider: ' + course.provider : ''} Suggested date: ${startDate}.${request_text ? ' Request: ' + request_text : ''} Please approve or reject this training booking.`,
        sourceHub: 'staff',
        sourceEntity: 'TrainingBooking',
        sourceId: booking.id,
        deepLink: '/staff?tab=training',
        priority: 'normal',
      });
    } catch (_) { /* don't block on inbox failure */ }

    // Notify admins so they can confirm/arrange — uses the email template system
    try {
      const cfgList = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'training_request' });
      const cfg = cfgList[0] || { accent_color: '#0e7a4f', banner_title: 'GC Mission Control', show_banner: true, footer_text: 'GC Mission Control' };
      if (cfg.enabled !== false) {
        let recipients = [];
        if (cfg.recipient_emails) {
          recipients = cfg.recipient_emails.split(',').map(s => s.trim()).filter(Boolean);
        } else {
          const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
          recipients = admins.filter(u => u.email).map(u => u.email);
        }

        const tok = {
          staff_name: staff_name,
          course_title: course.title || 'Training Course',
          provider: course.provider || 'TBC',
          suggested_date: startDate,
          request_text: request_text || `Renewal for ${docType}`,
        };

        let text;
        if (cfg.template) {
          text = cfg.template
            .replace(/\{staff_name\}/g, tok.staff_name)
            .replace(/\{course_title\}/g, tok.course_title)
            .replace(/\{provider\}/g, tok.provider)
            .replace(/\{suggested_date\}/g, tok.suggested_date)
            .replace(/\{request_text\}/g, tok.request_text);
        } else {
          const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
          text = intro + `A staff member has requested training via the self-service portal:\n\nStaff: ${tok.staff_name}\nSuggested course: ${tok.course_title}\nProvider: ${tok.provider}\nDate: ${tok.suggested_date}\n\nRequest: ${tok.request_text}\n\nPlease review and confirm the booking in the Training Manager (Admin → Training).\n\nGC Mission Control`;
        }

        const subject = cfg.subject
          ? cfg.subject.replace(/\{staff_name\}/g, tok.staff_name).replace(/\{course_title\}/g, tok.course_title)
          : `Training Request — ${tok.staff_name}: ${tok.course_title}`;

        const baseUrl = await getAppBaseUrl(base44);
        const bodyHtml = escapeHtml(text).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/admin', 'Open planner');

        for (const to of recipients) {
          try {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to,
              subject,
              body: styledHtml(bodyHtml, cfg),
            });
          } catch (_) {}
        }
      }
    } catch (_) {
      // Email failures shouldn't block the request
    }

    return Response.json({ course, booking, suggestion });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}