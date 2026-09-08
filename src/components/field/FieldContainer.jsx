import React from 'react';

/**
 * FieldContainer — THE shared responsive content container for every
 * field-crew page. Single source of truth for horizontal padding, max-width,
 * and top spacing so all five field tabs (Today, Upcoming, Scanner, Profile,
 * More) + Deliveries read as one native-feeling app with identical rhythm.
 *
 * Standard:
 *   max-w-5xl (64rem) — full-width on mobile, centered on tablet/desktop
 *   px-4 sm:px-6 lg:px-8 — consistent left/right padding at every breakpoint
 *   pt-3 md:pt-4 — consistent top padding below the sticky header
 *
 * Props:
 *   space  — vertical gap between children ('3' | '4' | '5'), default '3'
 *   mt     — optional top margin for stacked sections (e.g. 'mt-3', 'mt-4')
 *   as     — element type, default 'div'
 *   className — extra classes merged after the standard ones
 */
export default function FieldContainer({
  children,
  space = '3',
  mt = '',
  as: Tag = 'div',
  className = '',
  ...rest
}) {
  const spaceClass = {
    '3': 'space-y-3',
    '4': 'space-y-4',
    '5': 'space-y-5',
  }[space] || 'space-y-3';

  return (
    <Tag
      className={`max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 md:pt-4 ${spaceClass} ${mt} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}