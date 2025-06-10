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

  // Discovered links operations
  async addDiscoveredLinks(jobId, urls) {
    const links = urls.map((url) => ({
      job_id: jobId,
      url: url.url,
      is_internal: url.isInternal,
      depth: url.depth || 0,
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
};

// Export the clients for direct use when needed
export { supabase as default };
