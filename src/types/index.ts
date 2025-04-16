export type NewsletterType = 'AM' | 'PM' | 'Energy' | 'Health Care' | 'Breaking News';

export interface Advertiser {
  id: string;
  name: string;
  trackingUrls: string[];
  keywords: string[];
}

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

export interface SavedReport {
  id: string;
  name: string;
  criteria: ReportCriteria;
  createdAt: string;
  lastModified: string;
  filePath: string;
}

export interface AppSettings {
  mailchimpApiKey: string;
  audienceId: string;
  advertisers: Advertiser[];
} 