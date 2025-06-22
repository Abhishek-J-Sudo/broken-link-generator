import React, { useState } from 'react';
import {
  Book,
  Zap,
  Database,
  Globe,
  Shield,
  BarChart3,
  Settings,
  Download,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Code,
  Play,
  Search,
  Eye,
  Clock,
  Layers,
} from 'lucide-react';

const Documentation = () => {
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', title: 'Overview', icon: Book },
    { id: 'getting-started', title: 'Getting Started', icon: Play },
    { id: 'features', title: 'Features', icon: Zap },
    { id: 'api', title: 'API Reference', icon: Code },
    { id: 'crawl-modes', title: 'Crawl Modes', icon: Search },
    { id: 'seo-analysis', title: 'SEO Analysis', icon: BarChart3 },
    { id: 'architecture', title: 'Architecture', icon: Layers },
    { id: 'deployment', title: 'Deployment', icon: Settings },
    { id: 'troubleshooting', title: 'Troubleshooting', icon: AlertCircle },
  ];

  const SectionButton = ({ section, isActive, onClick }) => {
    const Icon = section.icon;
    return (
      <button
        onClick={() => onClick(section.id)}
        className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${
          isActive
            ? 'bg-indigo-100 text-indigo-700 border-l-4 border-indigo-600'
            : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        <Icon className="w-5 h-5" />
        <span className="font-medium">{section.title}</span>
      </button>
    );
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Broken Link Checker</h2>
              <p className="text-lg text-gray-600 mb-6">
                A comprehensive, AI-powered broken link detection and SEO analysis platform built
                with Next.js 15, Supabase, and modern web technologies.
              </p>

              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <Globe className="w-8 h-8 text-green-600 mb-3" />
                  <h3 className="font-semibold text-green-900">Smart Crawling</h3>
                  <p className="text-green-700 text-sm">
                    Intelligent URL discovery and filtering for efficient site analysis
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <BarChart3 className="w-8 h-8 text-blue-600 mb-3" />
                  <h3 className="font-semibold text-blue-900">SEO Analysis</h3>
                  <p className="text-blue-700 text-sm">
                    Comprehensive page scoring and optimization recommendations
                  </p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <Shield className="w-8 h-8 text-purple-600 mb-3" />
                  <h3 className="font-semibold text-purple-900">Enterprise Ready</h3>
                  <p className="text-purple-700 text-sm">
                    Rate limiting, security, and scalability for production use
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Key Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600">1000+</div>
                  <div className="text-sm text-gray-600">Pages Supported</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600">85+</div>
                  <div className="text-sm text-gray-600">Commits</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600">20+</div>
                  <div className="text-sm text-gray-600">Features</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600">99%</div>
                  <div className="text-sm text-gray-600">Accuracy</div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'getting-started':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Getting Started</h2>
              <p className="text-lg text-gray-600 mb-6">
                Start checking your website for broken links in under 30 seconds.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-semibold">
                  1
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Enter Your URL</h3>
                  <p className="text-gray-600">
                    Navigate to the Smart Analyzer and enter your website URL. The system supports
                    both small sites and large enterprise websites (1000+ pages).
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-semibold">
                  2
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Choose Analysis Mode</h3>
                  <p className="text-gray-600">
                    Select between Quick Analysis (discovered links) or Content Pages (deep crawl).
                    Enable SEO analysis for additional insights.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-semibold">
                  3
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Monitor Progress</h3>
                  <p className="text-gray-600">
                    Watch real-time progress updates as the system crawls your site and checks
                    links. View live logs and statistics.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-semibold">
                  4
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Review Results</h3>
                  <p className="text-gray-600">
                    Analyze broken links, SEO scores, and detailed reports. Export results in CSV or
                    JSON format for further analysis.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle className="w-6 h-6 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Quick Start Tips</h3>
              </div>
              <ul className="text-blue-800 space-y-2">
                <li>
                  • Start with a small website (under 100 pages) to familiarize yourself with the
                  interface
                </li>
                <li>• Enable SEO analysis for comprehensive site health insights</li>
                <li>• Use Content Pages mode for the most thorough link checking</li>
                <li>• Export results to CSV for reporting and tracking improvements</li>
              </ul>
            </div>
          </div>
        );

      case 'features':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Features</h2>
              <p className="text-lg text-gray-600 mb-6">
                Comprehensive toolkit for website health monitoring and optimization.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Search className="w-6 h-6 text-indigo-600" />
                  <h3 className="text-lg text-gray-800 font-semibold">Smart URL Discovery</h3>
                </div>
                <ul className="text-gray-600 space-y-2">
                  <li>• Intelligent content page detection</li>
                  <li>• Automatic parameter filtering</li>
                  <li>• Duplicate URL elimination</li>
                  <li>• Large site optimization (1000+ pages)</li>
                </ul>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <BarChart3 className="w-6 h-6 text-green-600" />
                  <h3 className="text-lg text-gray-800  font-semibold">SEO Analysis</h3>
                </div>
                <ul className="text-gray-600 space-y-2">
                  <li>• Page performance scoring</li>
                  <li>• Meta tag analysis</li>
                  <li>• Content optimization tips</li>
                  <li>• SEO summary reports</li>
                </ul>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Eye className="w-6 h-6 text-blue-600" />
                  <h3 className="text-lg text-gray-800 font-semibold">Real-time Monitoring</h3>
                </div>
                <ul className="text-gray-600 space-y-2">
                  <li>• Live progress tracking</li>
                  <li>• Detailed crawl logs</li>
                  <li>• Performance statistics</li>
                  <li>• Error classification</li>
                </ul>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Download className="w-6 h-6 text-purple-600" />
                  <h3 className="text-lg text-gray-800  font-semibold">Export & Reporting</h3>
                </div>
                <ul className="text-gray-600 space-y-2">
                  <li>• CSV/JSON export formats</li>
                  <li>• Detailed broken link reports</li>
                  <li>• SEO analysis exports</li>
                  <li>• Historical tracking</li>
                </ul>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-6 h-6 text-red-600" />
                  <h3 className="text-lg text-gray-800 font-semibold">Security & Rate Limiting</h3>
                </div>
                <ul className="text-gray-600 space-y-2">
                  <li>• CSRF protection</li>
                  <li>• Input validation with Zod</li>
                  <li>• Dynamic rate limiting</li>
                  <li>• Security event logging</li>
                </ul>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Clock className="w-6 h-6 text-orange-600" />
                  <h3 className="text-lg text-gray-800  font-semibold">Performance Optimization</h3>
                </div>
                <ul className="text-gray-600 space-y-2">
                  <li>• Concurrent request processing</li>
                  <li>• Intelligent batching</li>
                  <li>• Retry mechanisms</li>
                  <li>• Memory efficient operations</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 'api':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">API Reference</h2>
              <p className="text-lg text-gray-600 mb-6">
                RESTful API endpoints for programmatic access to broken link checking and SEO
                analysis.
              </p>
            </div>

            <div className="space-y-6">
              {/* Crawl API */}
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg text-gray-600 font-semibold">Crawl Management</h3>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-mono">
                        POST
                      </span>
                      <code className="text-sm text-gray-500">/api/crawl/start</code>
                    </div>
                    <p className="text-gray-600 mb-3">Start a new crawl job</p>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-500 mb-2">Request Body:</h4>
                      <pre className="text-sm text-gray-700 overflow-x-auto">
                        {`{
  "url": "https://example.com",
  "settings": {
    "maxDepth": 3,
    "enableSEO": true,
    "includeExternal": false,
    "crawlMode": "content_pages"
  }
}`}
                      </pre>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-mono">
                        GET
                      </span>
                      <code className="text-sm text-gray-500">/api/crawl/status/[jobId]</code>
                    </div>
                    <p className="text-gray-600">Get crawl job status and progress</p>
                  </div>
                </div>
              </div>

              {/* Results API */}
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-600">Results & Export</h3>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-mono">
                        GET
                      </span>
                      <code className="text-sm text-gray-500">/api/results/[jobId]</code>
                    </div>
                    <p className="text-gray-600 mb-3">Get paginated results for a crawl job</p>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2 text-gray-500">Query Parameters:</h4>
                      <ul className="text-sm text-gray-700 space-y-1">
                        <li>
                          <code>page</code> - Page number (default: 1)
                        </li>
                        <li>
                          <code>limit</code> - Results per page (default: 50, max: 100)
                        </li>
                        <li>
                          <code>filter</code> - Filter by status (all, broken, working)
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-mono">
                        GET
                      </span>
                      <code className="text-sm text-gray-500">/api/results/export/[jobId]</code>
                    </div>
                    <p className="text-gray-600">Export results in CSV or JSON format</p>
                  </div>
                </div>
              </div>

              {/* Analysis API */}
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-600">URL Analysis</h3>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-mono">
                        POST
                      </span>
                      <code className="text-sm text-gray-500">/api/analyze</code>
                    </div>
                    <p className="text-gray-600">Analyze website structure and discover URLs</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
                <h3 className="font-semibold text-yellow-900">Rate Limits</h3>
              </div>
              <p className="text-yellow-800">
                API endpoints have rate limiting in place to ensure fair usage and system stability.
                Limits vary by endpoint and user activity. Contact support if you need higher limits
                for enterprise use.
              </p>
            </div>
          </div>
        );

      case 'crawl-modes':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Crawl Modes</h2>
              <p className="text-lg text-gray-600 mb-6">
                Different crawling strategies optimized for various website types and analysis
                needs.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <h3 className="text-lg font-semibold text-gray-600">Quick Analysis Mode</h3>
                </div>
                <p className="text-gray-600 mb-4">
                  Fast discovery-based approach that identifies and checks links without deep
                  crawling.
                </p>
                <h4 className="font-medium mb-2 text-gray-500">Best for:</h4>
                <ul className="text-gray-600 space-y-1 mb-4">
                  <li>• Quick health checks</li>
                  <li>• Small to medium websites</li>
                  <li>• Initial assessments</li>
                  <li>• Regular monitoring</li>
                </ul>
                <h4 className="font-medium mb-2 text-gray-500">Process:</h4>
                <ol className="text-gray-600 space-y-1">
                  <li>1. Discovers all URLs from sitemap/robots.txt</li>
                  <li>2. Filters and deduplicates URLs</li>
                  <li>3. Checks HTTP status of discovered links</li>
                </ol>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <h3 className="text-lg font-semibold text-gray-600">Content Pages Mode</h3>
                </div>
                <p className="text-gray-600 mb-4">
                  Deep crawling that visits actual content pages and extracts all links for
                  comprehensive analysis.
                </p>
                <h4 className="font-medium mb-2 text-gray-500">Best for:</h4>
                <ul className="text-gray-600 space-y-1 mb-4">
                  <li>• Comprehensive audits</li>
                  <li>• Large enterprise websites</li>
                  <li>• SEO analysis</li>
                  <li>• Internal link optimization</li>
                </ul>
                <h4 className="font-medium mb-2 text-gray-500">Process:</h4>
                <ol className="text-gray-600 space-y-1">
                  <li>1. Identifies content pages from analysis</li>
                  <li>2. Visits each page and extracts all links</li>
                  <li>3. Checks extracted links for broken status</li>
                  <li>4. Provides detailed source URL tracking</li>
                </ol>
              </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-indigo-900 mb-4">Smart URL Filtering</h3>
              <p className="text-indigo-800 mb-4">
                Both modes use intelligent filtering to focus on meaningful content and avoid noise:
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-indigo-900 mb-2">Automatically Filters:</h4>
                  <ul className="text-indigo-800 space-y-1">
                    <li>• Parameter variations (?id=1, ?id=2)</li>
                    <li>• Pagination URLs (/page/1, /page/2)</li>
                    <li>• Date archives (/2024/01/, /2024/02/)</li>
                    <li>• Media files and admin pages</li>
                    <li>• Duplicate content patterns</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-indigo-900 mb-2">Focuses on:</h4>
                  <ul className="text-indigo-800 space-y-1">
                    <li>• Unique content pages</li>
                    <li>• Important site sections</li>
                    <li>• User-facing content</li>
                    <li>• SEO-relevant pages</li>
                    <li>• Internal link structures</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case 'seo-analysis':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">SEO Analysis</h2>
              <p className="text-lg text-gray-600 mb-6">
                Comprehensive SEO health checking and optimization recommendations for your website.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">95</div>
                <div className="text-green-800 font-medium">Average SEO Score</div>
                <div className="text-green-600 text-sm">Across analyzed pages</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">12</div>
                <div className="text-blue-800 font-medium">Check Categories</div>
                <div className="text-blue-600 text-sm">Comprehensive analysis</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">100%</div>
                <div className="text-purple-800 font-medium">Automated</div>
                <div className="text-purple-600 text-sm">No manual intervention</div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-600">SEO Metrics Analyzed</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Technical SEO</h4>
                    <ul className="text-gray-600 space-y-2">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Page title optimization
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Meta description analysis
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Header structure (H1-H6)
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Image alt text validation
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Internal linking analysis
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Content Quality</h4>
                    <ul className="text-gray-600 space-y-2">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Content length assessment
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Keyword density analysis
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Readability scoring
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Schema markup detection
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Performance indicators
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-600">SEO Scoring System</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-4 bg-green-500 rounded-full"></div>
                    <div>
                      <span className="font-medium text-gray-600">90-100:</span>
                      <span className="text-gray-600 ml-2">Excellent SEO optimization</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-4 bg-yellow-500 rounded-full"></div>
                    <div>
                      <span className="font-medium text-gray-600">70-89:</span>
                      <span className="text-gray-600 ml-2">Good, with room for improvement</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-4 bg-orange-500 rounded-full"></div>
                    <div>
                      <span className="font-medium text-gray-600">50-69:</span>
                      <span className="text-gray-600 ml-2">Needs optimization</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-4 bg-red-500 rounded-full"></div>
                    <div>
                      <span className="font-medium text-gray-600">0-49:</span>
                      <span className="text-gray-600 ml-2">Requires significant improvement</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">Export SEO Data</h3>
                <p className="text-blue-800 mb-4">
                  All SEO analysis results can be exported alongside broken link data for
                  comprehensive reporting:
                </p>
                <ul className="text-blue-800 space-y-2">
                  <li>• Individual page SEO scores</li>
                  <li>• Detailed issue breakdowns</li>
                  <li>• Optimization recommendations</li>
                  <li>• Historical tracking capabilities</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 'architecture':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Architecture</h2>
              <p className="text-lg text-gray-600 mb-6">
                Modern, scalable architecture built with Next.js 15, Supabase, and serverless
                technologies.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-600">Frontend Stack</h3>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-500">
                      <strong>Next.js 15:</strong> App Router with React 19
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-cyan-500 rounded-full"></div>
                    <span className="text-gray-500">
                      <strong>Tailwind CSS:</strong> Utility-first styling
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    <span className="text-gray-500">
                      <strong>Lucide React:</strong> Icon library
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-gray-500">
                      <strong>TypeScript:</strong> Type safety
                    </span>
                  </li>
                </ul>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-600">Backend Stack</h3>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <span className="text-gray-500">
                      <strong>Next.js API Routes:</strong> Serverless functions
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                    <span className="text-gray-500">
                      <strong>Supabase:</strong> PostgreSQL database
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-gray-500">
                      <strong>Axios:</strong> HTTP client
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span className="text-gray-500">
                      <strong>Cheerio:</strong> HTML parsing
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-600">Data Storage</h3>
              <p className="text-gray-500 mb-4">
                The application uses a modern database architecture to store crawl results, job
                tracking, and analysis data efficiently. All data is secured and follows best
                practices for data protection.
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3 text-gray-700">Core Features</h4>
                  <ul className="text-gray-500 space-y-2">
                    <li>• Job tracking and progress monitoring</li>
                    <li>• Broken link result storage</li>
                    <li>• URL discovery and status tracking</li>
                    <li>• Historical data retention</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-3 text-gray-700">Advanced Features</h4>
                  <ul className="text-gray-500 space-y-2">
                    <li>• SEO analysis and scoring</li>
                    <li>• Performance metrics</li>
                    <li>• Export capabilities</li>
                    <li>• Data visualization</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-600">Security Features</h3>
              <p className="text-gray-500 mb-4">
                The platform implements comprehensive security measures to protect user data and
                ensure system integrity.
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3 text-gray-700">Data Protection</h4>
                  <ul className="text-gray-500 space-y-2">
                    <li>• Input validation and sanitization</li>
                    <li>• Secure data transmission</li>
                    <li>• Access control mechanisms</li>
                    <li>• Data encryption at rest</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-3 text-gray-700">System Security</h4>
                  <ul className="text-gray-500 space-y-2">
                    <li>• Rate limiting and throttling</li>
                    <li>• Security monitoring</li>
                    <li>• Error handling and logging</li>
                    <li>• Regular security updates</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case 'deployment':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Deployment</h2>
              <p className="text-lg text-gray-600 mb-6">
                Production-ready deployment configuration for Vercel with automatic scaling and
                optimization.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-600">Vercel Configuration</h3>
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h4 className="font-medium mb-2 text-gray-400">vercel.json</h4>
                <pre className="text-sm text-gray-700 overflow-x-auto">
                  {`{
  "functions": {
    "src/app/api/crawl/start/route.js": {
      "maxDuration": 300
    },
    "src/app/api/crawl/status/[jobId]/route.js": {
      "maxDuration": 60
    }
  },
  "build": {
    "env": {
      "NEXT_TELEMETRY_DISABLED": "1"
    }
  }
}`}
                </pre>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-600">Environment Setup</h3>
                <p className="text-gray-600 mb-4">
                  The application requires several environment variables for proper configuration.
                  These should be set up in your deployment environment.
                </p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2 text-gray-600">Required Configuration</h4>
                  <ul className="text-gray-500 space-y-2">
                    <li>• Database connection settings</li>
                    <li>• API authentication keys</li>
                    <li>• Application configuration</li>
                    <li>• Security tokens and secrets</li>
                  </ul>
                  <p className="text-sm text-gray-500 mt-3">
                    Refer to the deployment guide or contact support for specific configuration
                    requirements.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-600">
                  Performance Optimizations
                </h3>
                <ul className="text-gray-500 space-y-2">
                  <li>• Serverless function optimization</li>
                  <li>• Edge caching for static content</li>
                  <li>• Database connection pooling</li>
                  <li>• Image optimization</li>
                  <li>• Bundle size optimization</li>
                  <li>• CDN integration</li>
                </ul>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-600">Deployment Steps</h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-semibold">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-600">Connect Repository</h4>
                    <p className="text-gray-500">Link your GitHub repository to Vercel</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-semibold">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-600">Configure Environment</h4>
                    <p className="text-gray-500">Set up Supabase environment variables</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-semibold">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-600">Deploy</h4>
                    <p className="text-gray-500">Automatic deployment on git push</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'troubleshooting':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Troubleshooting</h2>
              <p className="text-lg text-gray-600 mb-6">
                Common issues and solutions for optimal performance.
              </p>
            </div>

            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-600 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  Common Issues
                </h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900">Crawl job fails to start</h4>
                    <p className="text-gray-500 mb-2">Check the following:</p>
                    <ul className="text-gray-500 space-y-1 ml-4">
                      <li>• Ensure URL is valid and accessible</li>
                      <li>• Check rate limiting restrictions</li>
                      <li>• Verify Supabase connection</li>
                      <li>• Review server logs for errors</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900">Slow crawl performance</h4>
                    <p className="text-gray-500 mb-2">Optimize with these steps:</p>
                    <ul className="text-gray-500 space-y-1 ml-4">
                      <li>• Use Quick Analysis mode for faster results</li>
                      <li>• Reduce crawl depth for large sites</li>
                      <li>• Disable SEO analysis if not needed</li>
                      <li>• Check target website response times</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900">Memory or timeout errors</h4>
                    <p className="text-gray-500 mb-2">For large websites:</p>
                    <ul className="text-gray-500 space-y-1 ml-4">
                      <li>• Use the smart analyzer first</li>
                      <li>• Enable URL filtering</li>
                      <li>• Break large sites into sections</li>
                      <li>• Monitor serverless function limits</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg text-gray-600 font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Best Practices
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3 text-gray-500">
                      For Small Sites (&lt; 100 pages)
                    </h4>
                    <ul className="text-gray-400 space-y-2">
                      <li>• Use Content Pages mode</li>
                      <li>• Enable full SEO analysis</li>
                      <li>• Set max depth to 3-5</li>
                      <li>• Include external links if needed</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-3 text-gray-600">
                      For Large Sites (&gt; 1000 pages)
                    </h4>
                    <ul className="text-gray-400 space-y-2">
                      <li>• Start with URL analysis</li>
                      <li>• Use Quick Analysis mode first</li>
                      <li>• Limit crawl depth to 2-3</li>
                      <li>• Focus on internal links only</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">Need Help?</h3>
                <p className="text-blue-800 mb-4">
                  If you're experiencing issues not covered here:
                </p>
                <div className="flex flex-wrap gap-4">
                  <a
                    href="https://github.com/Abhishek-J-Sudo/broken-link-generator/issues"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Report an Issue
                  </a>
                  <a
                    href="https://github.com/Abhishek-J-Sudo/broken-link-generator"
                    className="bg-white text-blue-600 border border-blue-200 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Source Code
                  </a>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return <div>Section not found</div>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Documentation</h1>
        <p className="text-xl text-gray-600">
          Complete guide to using the Broken Link Checker platform
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Navigation */}
        <div className="lg:w-64 flex-shrink-0">
          <div className="bg-white border border-gray-200 rounded-lg p-4 sticky top-6">
            <nav className="space-y-2">
              {sections.map((section) => (
                <SectionButton
                  key={section.id}
                  section={section}
                  isActive={activeSection === section.id}
                  onClick={setActiveSection}
                />
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="bg-white border border-gray-200 rounded-lg p-8">{renderContent()}</div>
        </div>
      </div>

      {/* Footer */}
      {/* <div className="text-center text-gray-500 text-sm mt-12">
        <p>Built with ❤️ by Abhishek J Sudo | Made with Claude.ai</p>
        <p className="mt-1">
          <a 
            href="https://github.com/Abhishek-J-Sudo/broken-link-generator" 
            className="text-indigo-600 hover:text-indigo-800 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub →
          </a>
        </p>
      </div> */}
    </div>
  );
};

export default Documentation;
