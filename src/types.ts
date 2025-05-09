/**
 * Type definitions for the ROI Mailchimp Reporter application
 * These types are used throughout the application for data consistency
 */

/**
 * Newsletter types supported by the application
 * Corresponds to different ROI newsletter products
 */
export type NewsletterType = 'AM' | 'PM' | 'Energy' | 'Health Care' | 'Breaking News';

/**
 * Advertiser interface representing companies buying ad space
 * Includes tracking URLs and keywords for metrics calculation
 */
export interface Advertiser {
  id: string;
  name: string;
  trackingUrls: string[];
  keywords: string[];
}

/**
 * Application settings interface
 * Stores Mailchimp API credentials and advertiser data
 */
export interface AppSettings {
  mailchimpApiKey: string;
  audienceId: string;
  advertisers: Advertiser[];
}

/**
 * Form data structure for report generation
 * Maps directly to the form fields in the RunReport component
 */
export interface FormData {
  newsletterType: NewsletterType;
  advertiser: string;
  trackingUrls: string[];
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