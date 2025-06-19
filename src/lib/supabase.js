import { createClient } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate environment variables
if (!supabaseUrl) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
}

if (!supabaseAnonKey) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Client-side Supabase client (with anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We're not using auth for this app
    autoRefreshToken: false,
  },
});

// Server-side Supabase client (with service role key for admin operations)
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

// Database helper functions
export const db = {
  supabase,

  // Job operations
  async createJob(url, settings = {}) {
    const defaultSettings = {
      maxDepth: 3,
      includeExternal: false,
      timeout: 10000,
    };

    const { data, error } = await supabase
      .from('crawl_jobs')
      .insert({
        url,
        settings: { ...defaultSettings, ...settings },
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getJob(jobId) {
    const { data, error } = await supabase.from('crawl_jobs').select('*').eq('id', jobId).single();

    if (error) throw error;
    return data;
  },

  async updateJobStatus(jobId, status, errorMessage = null) {
    const updates = { status };

    if (status === 'completed' || status === 'failed') {
      updates.completed_at = new Date().toISOString();
    }

    if (errorMessage) {
      updates.error_message = errorMessage;
    }

    const { data, error } = await supabase
      .from('crawl_jobs')
      .update(updates)
      .eq('id', jobId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // NEW: Stop job function
  async stopJob(jobId) {
    const { data, error } = await supabase
      .from('crawl_jobs')
      .update({
        status: 'failed',
        error_message: 'Stopped by user',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateJobProgress(jobId, current, total) {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    const { data, error } = await supabase
      .from('crawl_jobs')
      .update({
        progress: {
          current,
          total,
          percentage,
        },
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // FIXED: Discovered links operations - now properly handles source URLs
  async addDiscoveredLinks(jobId, urls) {
    const links = urls.map((url) => ({
      job_id: jobId,
      url: url.url,
      source_url: url.sourceUrl || null, // FIXED: Now stores source URL
      is_internal: url.isInternal,
      depth: url.depth || 0,
      status: url.status || 'pending',
      // HTTP status fields (will be null initially, updated when checked)
      http_status_code: url.http_status_code || null,
      response_time: url.response_time || null,
      checked_at: url.checked_at || null,
      is_working: url.is_working || null,
      error_message: url.error_message || null,
    }));

    const { data, error } = await supabase
      .from('discovered_links')
      .upsert(links, {
        onConflict: 'job_id,url',
        ignoreDuplicates: true,
      })
      .select();

    if (error) throw error;
    return data;
  },

  // NEW: Update discovered link with HTTP status after checking
  async updateLinkHttpStatus(jobId, url, statusData) {
    const { data, error } = await supabase
      .from('discovered_links')
      .update({
        status: 'checked',
        http_status_code: statusData.http_status_code,
        response_time: statusData.response_time,
        checked_at: statusData.checked_at,
        is_working: statusData.is_working,
        error_message: statusData.error_message,
      })
      .eq('job_id', jobId)
      .eq('url', url)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getPendingLinks(jobId, limit = 50) {
    const { data, error } = await supabase
      .from('discovered_links')
      .select('*')
      .eq('job_id', jobId)
      .eq('status', 'pending')
      .limit(limit);

    if (error) throw error;
    return data;
  },

  async updateLinkStatus(linkId, status) {
    const { data, error } = await supabase
      .from('discovered_links')
      .update({ status })
      .eq('id', linkId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Broken links operations
  async addBrokenLink(jobId, brokenLinkData) {
    const { data, error } = await supabase
      .from('broken_links')
      .insert({
        job_id: jobId,
        url: brokenLinkData.url,
        source_url: brokenLinkData.sourceUrl,
        status_code: brokenLinkData.statusCode,
        error_type: brokenLinkData.errorType,
        link_text: brokenLinkData.linkText,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getBrokenLinks(jobId, { page = 1, limit = 50 } = {}) {
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('broken_links')
      .select('*', { count: 'exact' })
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      data,
      totalCount: count,
      currentPage: page,
      totalPages: Math.ceil(count / limit),
      hasNextPage: page < Math.ceil(count / limit),
      hasPrevPage: page > 1,
    };
  },

  // Analytics and summary
  async getJobSummary(jobId) {
    const [job, brokenCount, totalLinks] = await Promise.all([
      this.getJob(jobId),
      supabase
        .from('broken_links')
        .select('id', { count: 'exact' })
        .eq('job_id', jobId)
        .then(({ count }) => count),
      supabase
        .from('discovered_links')
        .select('id', { count: 'exact' })
        .eq('job_id', jobId)
        .then(({ count }) => count),
    ]);

    return {
      ...job,
      brokenLinksCount: brokenCount,
      totalLinksCount: totalLinks,
    };
  },

  async getRecentJobs(limit = 10) {
    const { data, error } = await supabase
      .from('crawl_jobs')
      .select('id, url, status, created_at, completed_at, progress')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  },

  /**
   * Save SEO analysis data for a URL
   */
  async addSEOAnalysis(jobId, seoData) {
    if (!seoData || seoData.error) {
      console.log('⏭️ Skipping SEO save - no valid data');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('seo_analysis')
        .insert({
          job_id: jobId,
          url: seoData.url,

          // Meta tags
          title_text: seoData.title?.text?.substring(0, 200) || null,
          title_length: seoData.title?.length || 0,
          meta_description: seoData.metaDescription?.text?.substring(0, 300) || null,
          description_length: seoData.metaDescription?.length || 0,
          canonical_url: seoData.canonicalUrl,

          // Content structure
          h1_count: seoData.headings?.h1Count || 0,
          h2_count: seoData.headings?.h2Count || 0,
          h3_count: seoData.headings?.h3Count || 0,
          word_count: seoData.wordCount || 0,
          content_length: seoData.contentLength || 0,

          // Images
          total_images: seoData.images?.totalImages || 0,
          missing_alt: seoData.images?.missingAlt || 0,
          alt_coverage: seoData.images?.altCoverage || 100,

          // Technical
          is_https: seoData.technical?.isHttps || false,
          response_time: seoData.technical?.responseTime || null,
          status_code: seoData.technical?.statusCode || null,

          // SEO score
          seo_score: seoData.score || 0,
          seo_grade: seoData.grade || 'F',
          issues_count: seoData.issues?.length || 0,
          issues: seoData.issues || [], // Supabase handles JSON automatically

          analyzed_at: seoData.analyzedAt || new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`💾 SEO: Saved analysis for ${seoData.url} (Score: ${seoData.score}/100)`);
      return data;
    } catch (error) {
      console.error('❌ Error saving SEO analysis:', error);
      throw error;
    }
  },

  /**
   * Get SEO analysis for a job with pagination and filtering
   */
  async getSEOAnalysis(jobId, options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        minScore = null,
        maxScore = null,
        grade = null,
        hasIssues = null,
        sortBy = 'seo_score',
        sortOrder = 'desc',
      } = options;

      let query = supabase.from('seo_analysis').select('*', { count: 'exact' }).eq('job_id', jobId);

      // Apply filters
      if (minScore !== null) query = query.gte('seo_score', minScore);
      if (maxScore !== null) query = query.lte('seo_score', maxScore);
      if (grade) query = query.eq('seo_grade', grade);
      if (hasIssues !== null) {
        query = hasIssues ? query.gt('issues_count', 0) : query.eq('issues_count', 0);
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: data || [],
        totalCount: count || 0,
        currentPage: page,
        totalPages: Math.ceil((count || 0) / limit),
        hasNextPage: page < Math.ceil((count || 0) / limit),
        hasPrevPage: page > 1,
      };
    } catch (error) {
      console.error('❌ Error getting SEO analysis:', error);
      throw error;
    }
  },

  /**
   * Get SEO summary for a job
   */
  async getSEOSummary(jobId) {
    try {
      // Use the view we created for efficient summary
      const { data, error } = await supabase
        .from('seo_job_summary')
        .select('*')
        .eq('job_id', jobId)
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('❌ Error getting SEO summary:', error);

      // Fallback: calculate summary manually
      return await this.calculateSEOSummary(jobId);
    }
  },

  /**
   * Calculate SEO summary manually (fallback)
   */
  async calculateSEOSummary(jobId) {
    try {
      const { data, error } = await supabase
        .from('seo_analysis')
        .select('seo_score, seo_grade, is_https, response_time, issues_count')
        .eq('job_id', jobId);

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          total_pages: 0,
          avg_score: 0,
          grade_distribution: {},
          total_issues: 0,
          https_pages: 0,
          avg_response_time: 0,
        };
      }

      const gradeDistribution = {
        grade_a_count: data.filter((d) => d.seo_grade === 'A').length,
        grade_b_count: data.filter((d) => d.seo_grade === 'B').length,
        grade_c_count: data.filter((d) => d.seo_grade === 'C').length,
        grade_d_count: data.filter((d) => d.seo_grade === 'D').length,
        grade_f_count: data.filter((d) => d.seo_grade === 'F').length,
      };

      return {
        total_pages: data.length,
        avg_score: Math.round(data.reduce((sum, d) => sum + d.seo_score, 0) / data.length),
        ...gradeDistribution,
        total_issues: data.reduce((sum, d) => sum + (d.issues_count || 0), 0),
        https_pages: data.filter((d) => d.is_https).length,
        avg_response_time:
          Math.round(
            data.filter((d) => d.response_time).reduce((sum, d) => sum + d.response_time, 0) /
              data.filter((d) => d.response_time).length
          ) || 0,
      };
    } catch (error) {
      console.error('❌ Error calculating SEO summary:', error);
      throw error;
    }
  },

  /**
   * Get top SEO issues across all pages in a job
   */
  async getTopSEOIssues(jobId, limit = 10) {
    try {
      const { data, error } = await supabase
        .from('seo_analysis')
        .select('issues')
        .eq('job_id', jobId)
        .gt('issues_count', 0);

      if (error) throw error;

      // Aggregate issues from all pages
      const issueCount = {};

      data.forEach((row) => {
        if (row.issues && Array.isArray(row.issues)) {
          row.issues.forEach((issue) => {
            const key = issue.message;
            issueCount[key] = (issueCount[key] || 0) + 1;
          });
        }
      });

      // Sort and return top issues
      const topIssues = Object.entries(issueCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([message, count]) => ({ message, count }));

      return topIssues;
    } catch (error) {
      console.error('❌ Error getting top SEO issues:', error);
      throw error;
    }
  },

  /**
   * Update discovered_links table to include SEO data reference
   */
  async updateLinkWithSEO(jobId, url, httpStatusData, seoData = null) {
    try {
      // First, update the HTTP status (existing functionality)
      const { error: httpError } = await supabase
        .from('discovered_links')
        .update({
          status: 'checked',
          http_status_code: httpStatusData.http_status_code,
          response_time: httpStatusData.response_time,
          checked_at: httpStatusData.checked_at,
          is_working: httpStatusData.is_working,
          error_message: httpStatusData.error_message,
          has_seo_data: !!seoData, // NEW: Flag indicating SEO analysis was done
        })
        .eq('job_id', jobId)
        .eq('url', url);

      if (httpError) {
        console.error('❌ Error updating discovered link:', httpError);
      }

      // If we have SEO data, save it separately
      if (seoData && !seoData.error) {
        await this.addSEOAnalysis(jobId, seoData);
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Error updating link with SEO:', error);
      throw error;
    }
  },

  /**
   * Get enhanced results with SEO data
   */
  async getEnhancedResults(jobId, options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        includeSEO = true,
        statusFilter = 'all',
        seoGrade = null,
        minSeoScore = null,
      } = options;

      // Base query for discovered links
      let query = supabase
        .from('discovered_links')
        .select(
          `
          *,
          ${
            includeSEO
              ? `
            seo_analysis!left (
              seo_score,
              seo_grade,
              title_text,
              meta_description,
              h1_count,
              total_images,
              missing_alt,
              issues_count,
              issues
            )
          `
              : ''
          }
        `,
          { count: 'exact' }
        )
        .eq('job_id', jobId)
        .eq('status', 'checked');

      // Apply filters
      if (statusFilter === 'working') {
        query = query.eq('is_working', true);
      } else if (statusFilter === 'broken') {
        query = query.eq('is_working', false);
      }

      // SEO filters
      if (includeSEO && seoGrade) {
        query = query.eq('seo_analysis.seo_grade', seoGrade);
      }

      if (includeSEO && minSeoScore !== null) {
        query = query.gte('seo_analysis.seo_score', minSeoScore);
      }

      // Pagination
      const offset = (page - 1) * limit;
      query = query.order('checked_at', { ascending: false }).range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        links: data || [],
        totalCount: count || 0,
        currentPage: page,
        totalPages: Math.ceil((count || 0) / limit),
        hasNextPage: page < Math.ceil((count || 0) / limit),
        hasPrevPage: page > 1,
        includedSEO: includeSEO,
      };
    } catch (error) {
      console.error('❌ Error getting enhanced results:', error);
      throw error;
    }
  },
};

// Export the clients for direct use when needed
export { supabase as default };
