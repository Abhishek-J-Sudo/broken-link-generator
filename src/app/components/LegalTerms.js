// src/app/components/LegalTerms.js
'use client';

import { useState } from 'react';

export default function LegalTerms({ variant = 'banner' }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (variant === 'banner') {
    return (
      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-b border-yellow-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="text-center">
            <p className="text-sm text-yellow-800">
              <span className="font-semibold">⚖️ Legal Notice:</span> By using this service, you
              agree to the legal terms and conditions.
              <span className="font-semibold text-gray-500">
                {' '}
                You are solely responsible for any legal consequences.
              </span>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-blue-600 hover:text-blue-800 ml-2 underline"
              >
                {isExpanded ? 'Hide legal terms' : 'View legal terms'}
              </button>
            </p>

            {isExpanded && (
              <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200 text-left max-w-4xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-3 bg-red-50 border border-red-200 rounded">
                    <h4 className="font-semibold text-red-900 mb-2">⚠️ USER LIABILITY</h4>
                    <ul className="text-xs text-red-800 space-y-1">
                      <li>
                        • You are SOLELY responsible for ensuring scans are legal and authorized
                      </li>
                      <li>
                        • You must comply with all applicable laws (CFAA, GDPR, cybersecurity laws)
                      </li>
                      <li>• Unauthorized scanning may result in criminal or civil penalties</li>
                      <li>
                        • You indemnify and hold harmless the service provider from any legal issues
                      </li>
                    </ul>
                  </div>

                  <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                    <h4 className="font-semibold text-gray-900 mb-2">🛡️ SERVICE DISCLAIMER</h4>
                    <ul className="text-xs text-gray-700 space-y-1">
                      <li>• Service provided "AS-IS" without any warranties or guarantees</li>
                      <li>• We are NOT liable for any damages, losses, or legal consequences</li>
                      <li>
                        • No responsibility for false positives, missed issues, or service errors
                      </li>
                      <li>• Service may be discontinued or modified without notice</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-center">
                  <p className="text-sm text-yellow-800">
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
    <div className="bg-gray-100 border-t border-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="text-center">
          <p className="text-sm text-gray-700">
            <strong>Legal:</strong> You are solely responsible for ensuring authorized use. Service
            provided "as-is" without warranties. Website owner not liable for any legal consequences
            of your usage.
          </p>
        </div>
      </div>
    </div>
  );
}
