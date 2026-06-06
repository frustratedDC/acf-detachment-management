/**
 * Central audit log for development status flags across the application.
 * Maps routes to their development status and detailed audit information.
 */

export const FEATURE_AUDIT_LOG = {
  '/analytics': {
    inDevelopment: true,
    reason: 'Executive dashboard metrics are being refined for production readiness.',
    details: [
      'Real-time data aggregation from attendance and qualification entities',
      'Color-coded status indicators for rapid assessment',
      'Interactive navigation to detailed reports',
    ],
    estimatedCompletion: 'Q3 2026',
  },
  '/cfav-governance': {
    inDevelopment: true,
    reason: 'CFAV governance audit and compliance tracking interface still in development.',
    details: [
      'Integration with PolicyRegistry and CFAVGovernance entities',
      'Compliance status tracking for adult instructors',
      'Automated renewal deadline alerts',
    ],
    estimatedCompletion: 'Q3 2026',
  },
};

/**
 * Get audit information for a given route.
 * @param {string} route - The page route (e.g., '/analytics')
 * @returns {Object|null} Audit object or null if route not flagged
 */
export function getAuditInfo(route) {
  return FEATURE_AUDIT_LOG[route] || null;
}

/**
 * Check if a route is flagged as in development.
 * @param {string} route - The page route
 * @returns {boolean} True if flagged
 */
export function isInDevelopment(route) {
  const audit = getAuditInfo(route);
  return audit?.inDevelopment === true;
}