'use client';

import { useState } from 'react';

export default function LegalTerms({ variant = 'banner' }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (variant === 'banner') {
    return (
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="text-center">
            <p className="text-sm text-amber-800">
              <span className="font-semibold">⚖️ Legal Notice:</span> By using this service, you
              agree to the legal terms and conditions.
              <span className="font-semibold text-slate-600">
                {' '}
                You are solely responsible for any legal consequences.
              </span>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-blue-600 hover:text-blue-800 ml-2 underline transition-colors duration-200"
              >
                {isExpanded ? 'Hide legal terms' : 'View legal terms'}
              </button>
            </p>

            {isExpanded && (
              <div className="mt-4 p-6 bg-white rounded-2xl border border-slate-200 text-left max-w-4xl mx-auto shadow-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <h4 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                      </svg>
                      USER LIABILITY
                    </h4>
                    <ul className="text-sm text-red-800 space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-red-600 rounded-full mt-2 flex-shrink-0"></span>
                        You are SOLELY responsible for ensuring scans are legal and authorized
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-red-600 rounded-full mt-2 flex-shrink-0"></span>
                        You must comply with all applicable laws (CFAA, GDPR, cybersecurity laws)
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-red-600 rounded-full mt-2 flex-shrink-0"></span>
                        Unauthorized scanning may result in criminal or civil penalties
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-red-600 rounded-full mt-2 flex-shrink-0"></span>
                        You indemnify and hold harmless the service provider from any legal issues
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                      SERVICE DISCLAIMER
                    </h4>
                    <ul className="text-sm text-slate-700 space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-slate-600 rounded-full mt-2 flex-shrink-0"></span>
                        Service provided "AS-IS" without any warranties or guarantees
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-slate-600 rounded-full mt-2 flex-shrink-0"></span>
                        We are NOT liable for any damages, losses, or legal consequences
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-slate-600 rounded-full mt-2 flex-shrink-0"></span>
                        No responsibility for false positives, missed issues, or service errors
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-slate-600 rounded-full mt-2 flex-shrink-0"></span>
                        Service may be discontinued or modified without notice
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
                  <p className="text-sm text-amber-800">
                    <strong>
                      By proceeding, you acknowledge that you have read and agree to these terms.
                    </strong>{' '}
                    If you do not agree, you must not use this service.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Compact footer version
  return (
    <div className="bg-slate-100 border-t border-slate-300 rounded-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="text-center">
          <p className="text-sm text-slate-700">
            <strong>Legal:</strong> You are solely responsible for ensuring authorized use. Service
            provided "as-is" without warranties. Website owner not liable for any legal consequences
            of your usage.
          </p>
        </div>
      </div>
    </div>
  );
}
