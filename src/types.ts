export type NewsletterType = 'AM' | 'PM' | 'Energy' | 'Health Care' | 'Breaking News';

export interface Advertiser {
  id: string;
  name: string;
  trackingUrls: string[];
  keywords: string[];
}

export interface AppSettings {
  mailchimpApiKey: string;
  audienceId: string;
  advertisers: Advertiser[];
}

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