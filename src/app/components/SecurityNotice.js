// Create this file: src/app/components/SecurityNotice.js

'use client';

import { useState } from 'react';

export default function SecurityNotice({ variant = 'compact' }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (variant === 'compact') {
    return (
      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-t border-yellow-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-600"
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
                <p className="text-sm text-yellow-800">
                  <strong>Security Notice:</strong> Only scan websites you own or have permission to
                  test. Internal networks and unauthorized scanning are automatically blocked.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-yellow-600 hover:text-yellow-800 text-sm font-medium"
            >
              {isExpanded ? 'Less info' : 'More info'}
            </button>
          </div>

          {isExpanded && (
            <div className="mt-3 border-t border-yellow-200 pt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-yellow-700">
                <div>
                  <h4 className="font-medium text-yellow-800 mb-2">✅ What's Allowed:</h4>
                  <ul className="space-y-1">
                    <li>• Websites you own or manage</li>
                    <li>• Sites with explicit permission</li>
                    <li>• Public websites for legitimate testing</li>
                    <li>• Respects robots.txt and rate limits</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-yellow-800 mb-2">🚫 Automatically Blocked:</h4>
                  <ul className="space-y-1">
                    <li>• localhost and 127.0.0.1</li>
                    <li>• Private networks (192.168.x.x, 10.x.x.x)</li>
                    <li>• Cloud metadata services (AWS, Azure, GCP)</li>
                    <li>• Internal domains (.internal, .local)</li>
                  </ul>
                </div>
              </div>
              <div className="mt-3 p-2 bg-yellow-500 text-white rounded text-xs">
                <strong>For Website Owners:</strong> This tool only checks link availability and
                doesn't store content. To block our scanner, add to robots.txt:
                <code className="bg-white text-gray-500 px-1 rounded font-mono">
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
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
      <h3 className="text-sm font-medium text-yellow-800 mb-2">⚠️ Security & Usage Guidelines</h3>
      <ul className="text-xs text-yellow-700 space-y-1 mb-3">
        <li>• Only scan websites you own or have permission to test</li>
        <li>• Respects robots.txt and implements rate limiting</li>
        <li>• Internal networks (localhost, private IPs) are automatically blocked</li>
        <li>• Do not use for unauthorized scanning or competitive intelligence</li>
        <li>• Large scans may trigger security alerts on target websites</li>
      </ul>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="p-2 bg-green-50 rounded border border-green-200">
          <strong className="text-green-800">✅ Allowed:</strong>
          <div className="text-green-700 mt-1">
            Your own websites, sites with permission, legitimate testing
          </div>
        </div>
        <div className="p-2 bg-red-50 rounded border border-red-200">
          <strong className="text-red-800">🚫 Blocked:</strong>
          <div className="text-red-700 mt-1">
            localhost, private networks (192.168.x.x, 10.x.x.x), cloud metadata
          </div>
        </div>
      </div>

      <div className="mt-3 p-2 bg-yellow-500 text-white rounded text-xs">
        <strong>For Website Owners:</strong> This tool only checks link availability and doesn't
        store content. <br /> To block our scanner, add to robots.txt:{' '}
        <code className="bg-white text-gray-500 px-1 rounded font-mono">
          User-agent: Broken Link Checker Bot && Disallow: /
        </code>
      </div>
    </div>
  );
}
