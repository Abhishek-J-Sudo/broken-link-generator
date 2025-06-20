'use client';

import { useState } from 'react';

export default function SecurityNotice({ variant = 'compact' }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (variant === 'compact') {
    return (
      <div className="mt-8 p-4 bg-amber-50 rounded-xl border border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-amber-600"
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
              </div>
              <div>
                <p className="text-sm text-gray-800">
                  <strong>Security Notice:</strong> Only scan websites you own or have permission to
                  test. Internal networks and unauthorized scanning are automatically blocked.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors duration-200"
            >
              {isExpanded ? 'Less info' : 'More info'}
            </button>
          </div>

          {isExpanded && (
            <div className="mt-3 border-t border-gray-200 pt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-700">
                <div>
                  <h4 className="font-medium text-gray-800 mb-2">✅ What's Allowed:</h4>
                  <ul className="space-y-1">
                    <li>• Websites you own or manage</li>
                    <li>• Sites with explicit permission</li>
                    <li>• Public websites for legitimate testing</li>
                    <li>• Respects robots.txt and rate limits</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-gray-800 mb-2">🚫 Automatically Blocked:</h4>
                  <ul className="space-y-1">
                    <li>• localhost and 127.0.0.1</li>
                    <li>• Private networks (192.168.x.x, 10.x.x.x)</li>
                    <li>• Cloud metadata services (AWS, Azure, GCP)</li>
                    <li>• Internal domains (.internal, .local)</li>
                  </ul>
                </div>
              </div>
              <div className="mt-3 p-3 bg-slate-600 text-white rounded-xl text-xs">
                <strong>For Website Owners:</strong> This tool only checks link availability and
                doesn't store content. To block our scanner, add to robots.txt:
                <code className="text-white/80 px-2 py-1 rounded font-mono ml-2">
                  User-agent: Broken Link Checker Bot && Disallow: /
                </code>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full variant for form pages
  return (
    <div className="bg-slate-100 border border-slate-200 rounded-xl p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        Security & Usage Guidelines
      </h3>
      <ul className="text-sm text-gray-700 space-y-2 mb-4">
        <li className="flex items-start gap-2">
          <span className="w-1.5 h-1.5 bg-gray-600 rounded-full mt-2 flex-shrink-0"></span>
          Only scan websites you own or have permission to test
        </li>
        <li className="flex items-start gap-2">
          <span className="w-1.5 h-1.5 bg-gray-600 rounded-full mt-2 flex-shrink-0"></span>
          Respects robots.txt and implements rate limiting
        </li>
        <li className="flex items-start gap-2">
          <span className="w-1.5 h-1.5 bg-gray-600 rounded-full mt-2 flex-shrink-0"></span>
          Internal networks (localhost, private IPs) are automatically blocked
        </li>
        <li className="flex items-start gap-2">
          <span className="w-1.5 h-1.5 bg-gray-600 rounded-full mt-2 flex-shrink-0"></span>
          Do not use for unauthorized scanning or competitive intelligence
        </li>
        <li className="flex items-start gap-2">
          <span className="w-1.5 h-1.5 bg-gray-600 rounded-full mt-2 flex-shrink-0"></span>
          Large scans may trigger security alerts on target websites
        </li>
      </ul>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
        <div className="p-4 bg-green-50 rounded-xl border border-green-200">
          <strong className="text-green-800 flex items-center gap-2 mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Allowed:
          </strong>
          <div className="text-green-700">
            Your own websites, sites with permission, legitimate testing
          </div>
        </div>
        <div className="p-4 bg-red-50 rounded-xl border border-red-200">
          <strong className="text-red-800 flex items-center gap-2 mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Blocked:
          </strong>
          <div className="text-red-700">
            localhost, private networks (192.168.x.x, 10.x.x.x), cloud metadata
          </div>
        </div>
      </div>

      <div className="p-4 bg-gray-600 text-white rounded-xl text-sm">
        <strong>For Website Owners:</strong> This tool only checks link availability and doesn't
        store content. <br /> To block our scanner, add to robots.txt:{' '}
        <code className="bg-white text-slate-600 px-2 py-1 rounded font-mono ml-1">
          User-agent: Broken Link Checker Bot && Disallow: /
        </code>
      </div>
    </div>
  );
}
