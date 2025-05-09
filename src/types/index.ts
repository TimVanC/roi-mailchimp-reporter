/**
 * Type definitions and interfaces for the ROI Mailchimp Reporter
 * This file centralizes all types used across the application
 */

/**
 * Newsletter types available in Mailchimp campaigns
 * These represent the different newsletter products offered by ROI
 */
export type NewsletterType = 'AM' | 'PM' | 'Energy' | 'Health Care' | 'Breaking News';

/**
 * Advertiser entity representing companies placing ads
 * Contains tracking information for measuring campaign effectiveness
 */
export interface Advertiser {
  id: string;
  name: string;
  trackingUrls: string[];
  keywords: string[];
}

/**
 * Report criteria configuration used when generating new reports
 * Defines all parameters needed to generate a Mailchimp campaign report
 */
export interface ReportCriteria {
  newsletterType: NewsletterType;
  advertiser: Advertiser;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  metrics: {
    uniqueOpens: boolean;
    totalOpens: boolean;
    totalRecipients: boolean;
    totalClicks: boolean;
    ctr: boolean;
  };
}

/**
 * Saved report structure representing a report persisted to disk
 * Contains both the criteria used to generate it and metadata
 */
export interface SavedReport {
  id: string;
  name: string;
  criteria: ReportCriteria;
  createdAt: string;
  lastModified: string;
  filePath: string;
}

/**
 * Application settings structure
 * Stores API credentials and advertiser information
 */
export interface AppSettings {
  mailchimpApiKey: string;
  audienceId: string;
  advertisers: Advertiser[];
} 