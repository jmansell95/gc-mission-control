import React from 'react';
import { CalendarDays } from 'lucide-react';
import { EmptyState, Skeleton, SkeletonText } from '@/components/StateViews';
import WeeklyRotaView from '@/components/staff/WeeklyRotaView';
import FieldPageShell from '@/components/field/FieldPageShell';
import FieldContainer from '@/components/field/FieldContainer';
import DivisionIdentityBar from '@/components/DivisionIdentityBar';
import { useFieldData } from '@/components/field/FieldDataProvider';

export default function UpcomingPage() {
  const ctx = useFieldData();
  const { activeDivision, visibleAssignments, assignmentsLoading, jobs, vehicles, staff } = ctx;

  return (
    <FieldPageShell
      title="Upcoming"
      subtitle="Your future shifts"
      icon={CalendarDays}
      transparent
      contentClassName="pb-24"
      accentColor={activeDivision?.color}
    >
      <DivisionIdentityBar />
      <FieldContainer>
        {assignmentsLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="field-card p-5">
                <Skeleton className="h-1.5 w-full mb-4 rounded-full" />
                <Skeleton className="h-4 w-1/3 mb-3" />
                <SkeletonText lines={3} />
              </div>
            ))}
          </div>
        ) : visibleAssignments.length === 0 ? (
          <div className="field-card">
            <EmptyState icon={CalendarDays} title="No shifts scheduled" message="Check back later — your manager will assign you to upcoming jobs." />
          </div>
        ) : (
          <WeeklyRotaView
            assignments={visibleAssignments}
            jobs={jobs}
            vehicles={vehicles}
            staff={staff}
          />
        )}
      </FieldContainer>
    </FieldPageShell>
  );
}