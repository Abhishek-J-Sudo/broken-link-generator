import { NextResponse } from 'next/server';
import { urlUtils } from '@/lib/utils';
import { securityUtils } from '@/lib/security';
import { db } from '@/lib/supabase';
import { validateCrawlRequest, validateAdvancedRateLimit } from '@/lib/validation';
import { logBlockedUrl, logInvalidInput, logRobotsBlocked } from '@/lib/securityLogger';
import { errorHandler, handleValidationError } from '@/lib/errorHandler';
import { getClientIp } from '@/lib/clientIp';
import { corsOrigin } from '@/lib/cors';
import { enqueueCrawl } from '@/lib/queue/index';
import { csrfProtect, CsrfError } from '@/lib/csrf';

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
};

export async function POST(request) {
  try {
    await csrfProtect(request, new NextResponse());
  } catch (e) {
    if (e instanceof CsrfError) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403, headers: securityHeaders });
    }
    throw e;
  }

  let jobId = null;
  let body;

  try {
    try {
      body = await request.json();
    } catch {
      return await errorHandler.handleError(new Error('Invalid JSON in request body'), request, {
        step: 'json_parsing',
      });
    }

    const clientIP = getClientIp(request);
    const rateLimit = await validateAdvancedRateLimit(clientIP, 'crawl');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': rateLimit.retryAfter.toString(), ...securityHeaders } }
      );
    }

    const requestValidation = validateCrawlRequest(body);
    if (!requestValidation.success) {
      await logInvalidInput(request, requestValidation.errors, body);
      return await handleValidationError(new Error('Request validation failed'), request);
    }

    const { url: validatedUrl, settings: validatedSettings, preAnalyzedUrls: validatedPreAnalyzedUrls } =
      requestValidation.data;

    const normalizedUrl = urlUtils.normalizeUrl(validatedUrl);

    const urlSafety = securityUtils.isSafeUrl(normalizedUrl);
    if (!urlSafety.safe) {
      await logBlockedUrl(request, normalizedUrl, urlSafety.reason);
      return NextResponse.json(
        { error: 'URL blocked for security reasons', reason: urlSafety.reason, code: 'SECURITY_BLOCKED' },
        { status: 403, headers: securityHeaders }
      );
    }

    if (validatedSettings.respectRobots !== false) {
      try {
        const robotsCheck = await securityUtils.checkRobotsTxt(normalizedUrl);
        if (!robotsCheck.allowed) {
          await logRobotsBlocked(request, normalizedUrl, robotsCheck.reason);
          return NextResponse.json(
            { error: 'Crawling not allowed by robots.txt', reason: robotsCheck.reason, code: 'ROBOTS_BLOCKED' },
            { status: 403, headers: securityHeaders }
          );
        }
        if (robotsCheck.crawlDelay) {
          validatedSettings.delayBetweenRequests = Math.max(
            validatedSettings.delayBetweenRequests || 100,
            robotsCheck.crawlDelay
          );
        }
      } catch {
        // robots.txt unreachable — proceed
      }
    }

    const jobSettings = {
      maxDepth: validatedSettings.maxDepth || 3,
      includeExternal: validatedSettings.includeExternal || false,
      timeout: validatedSettings.timeout || 10000,
      usePreAnalyzedUrls: !!validatedPreAnalyzedUrls,
      crawlMode: validatedSettings.crawlMode || 'auto',
      enableSEO: validatedSettings.enableSEO || false,
    };

    const job = await db.createJob(normalizedUrl, jobSettings);
    jobId = job.id;

    const responseHeaders = { ...securityHeaders, ...(rateLimit.headers || {}) };

    if (validatedPreAnalyzedUrls?.length > 0) {
      await enqueueCrawl(jobId, 'smart', normalizedUrl, validatedPreAnalyzedUrls, jobSettings);

      return NextResponse.json(
        {
          success: true,
          jobId,
          status: 'queued',
          url: normalizedUrl,
          settings: jobSettings,
          urlsToCheck: validatedPreAnalyzedUrls.length,
          crawlMode: jobSettings.crawlMode,
          message:
            jobSettings.crawlMode === 'content_pages'
              ? `Content pages crawl queued — will visit ${validatedPreAnalyzedUrls.length} pages to extract and check links`
              : jobSettings.crawlMode === 'discovered_links'
              ? `Discovered links crawl queued — will check ${validatedPreAnalyzedUrls.length} pre-analyzed links directly`
              : `Smart crawl queued with ${validatedPreAnalyzedUrls.length} pre-analyzed URLs`,
          statusUrl: `/api/crawl/status/${jobId}`,
          resultsUrl: `/api/results/${jobId}`,
          crawlType: 'smart',
        },
        { status: 201, headers: responseHeaders }
      );
    }

    await enqueueCrawl(jobId, 'traditional', normalizedUrl, null, jobSettings);

    return NextResponse.json(
      {
        success: true,
        jobId,
        status: 'queued',
        url: normalizedUrl,
        settings: jobSettings,
        message: 'Traditional crawl queued — discovering and checking links',
        statusUrl: `/api/crawl/status/${jobId}`,
        resultsUrl: `/api/results/${jobId}`,
        crawlType: 'traditional',
      },
      { status: 201, headers: securityHeaders }
    );
  } catch (error) {
    if (jobId) {
      try {
        await db.updateJobStatus(jobId, 'failed', 'Internal error');
      } catch {}
    }
    return await errorHandler.handleError(error, request, { step: 'crawl_start', jobId, url: body?.url });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
